import type { EnvironmentConfig, RsbuildConfig, Rspack } from "@rsbuild/core";
import type { Nitro, NitroServiceLoader } from "nitro/types";
import type { NitroRsbuildContext } from "./_context.ts";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join, resolve } from "pathe";
import { runtimeDir } from "#nitro/meta";
import { prettyPath } from "../../utils/fs.ts";
import { checkServerEntry, findSSREntry, useSSRServiceRenderer } from "../services.ts";
import { useNitro } from "./_context.ts";
import { NITRO_RUNTIME_IDS, RUNTIME_MODULES_ID, runtimeModulesTemplate } from "./_virtual.ts";
import { ASSETS_ID, assetsTemplate } from "./_assets.ts";

const SSR_OUTLET = "<!--ssr-outlet-->";

export interface RsbuildService {
  /** Output entry of the service. */
  entry: string;
}

/**
 * Builds the Nitro `services` with server environments (`target: "node"`): an environment is added
 * for each service (and `ssr` for an `entry-server` file in `app/`, `src/` or the root dir), and
 * the other server environments are registered as services.
 */
export function configureServices(
  ctx: NitroRsbuildContext,
  config: RsbuildConfig,
  environments: Record<string, EnvironmentConfig>,
  reservedEnvs: string[]
) {
  const nitro = useNitro(ctx);
  const services = nitro.options.services;

  if (!environments.ssr && !services.ssr) {
    const ssrEntry = findSSREntry(nitro);
    if (ssrEntry) {
      services.ssr = { entry: ssrEntry };
      nitro.logger.info(`Using \`${prettyPath(ssrEntry)}\` as rsbuild ssr entry.`);
    }
  }
  for (const [name, service] of Object.entries(services)) {
    if (reservedEnvs.includes(name)) {
      throw new Error(
        `Service \`${name}\` cannot be built with Rsbuild: \`${name}\` is a client or the \`nitro\` environment.`
      );
    }
    const env = environments[name];
    environments[name] = {
      ...env,
      source: { ...env?.source, entry: env?.source?.entry ?? { index: service.entry } },
      output: { ...env?.output, target: "node" },
    };
  }

  ctx.services = {};
  for (const [name, env] of Object.entries(environments)) {
    if (reservedEnvs.includes(name) || (env.output?.target ?? config.output?.target) !== "node") {
      continue;
    }
    const entry = env.source?.entry ?? config.source?.entry;
    const [entryName = "index", entryImport] = Object.entries(entry || {})[0] || [];
    services[name] ??= { entry: sourceEntry(nitro, entryImport) ?? name };
    const outDir = resolve(nitro.options.buildDir, "rsbuild/services", name);
    ctx.services[name] = { entry: join(outDir, `${entryName}.mjs`) };
    environments[name] = mergeEnv(env, {
      output: {
        target: "node",
        module: true,
        distPath: { root: outDir },
        filename: { js: "[name].mjs" },
        externals: [nitroRuntimeExternals(ctx)],
      },
      dev: { writeToDisk: true, hmr: false, liveReload: false },
      // Bundled into the server output (printed by Nitro)
      performance: { printFileSize: false },
      // One module per entry: Nitro bundles it (chunk loading would import every output file)
      tools: {
        rspack: (config) => void (config.output = { ...config.output, asyncChunks: false }),
      },
    });
  }

  nitro._serviceLoader = (name) => serviceLoader(ctx, name);
  if (ctx.dev && Object.keys(ctx.services).length > 0) {
    nitro.options.virtual[RUNTIME_MODULES_ID] = () => runtimeModulesTemplate(ctx);
    nitro.options.plugins.push(RUNTIME_MODULES_ID);
  }
  nitro.options.virtual[ASSETS_ID] = () => assetsTemplate(ctx);
  checkServerEntry(nitro);

  // Renderer: the HTML generated from the Rsbuild HTML template (when it is the renderer template,
  // or has an SSR outlet), compiled into the renderer template (`_pageTemplate`). Otherwise the
  // `ssr` service itself (unless a renderer is set)
  const renderer = (nitro.options.renderer ??= {});
  const templateHandler = join(
    runtimeDir,
    "internal/routes/renderer-template" + (nitro.options.dev ? ".dev" : "")
  );
  const customHandler = renderer.handler && renderer.handler !== templateHandler;
  const htmlTemplate = environments[ctx.clientEnvs[0]!]?.html?.template ?? config.html?.template;
  const htmlTemplatePath =
    typeof htmlTemplate === "string" ? resolve(nitro.options.rootDir, htmlTemplate) : undefined;
  const hasOutlet = () =>
    !!htmlTemplatePath &&
    existsSync(htmlTemplatePath) &&
    readFileSync(htmlTemplatePath, "utf8").includes(SSR_OUTLET);
  if (
    htmlTemplatePath &&
    !customHandler &&
    (renderer.template === htmlTemplatePath || (!renderer.template && services.ssr && hasOutlet()))
  ) {
    ctx.pageTemplate = true;
    renderer.template = htmlTemplatePath;
    renderer.handler = templateHandler;
    nitro._pageTemplate = { ...nitro._pageTemplate, html: () => ctx.pageHTML };
    nitro.routing.sync();
  } else {
    useSSRServiceRenderer(nitro);
  }
}

/**
 * Production: the service output is bundled by Nitro. Development: the dev worker imports it from
 * disk (again after a reload).
 */
function serviceLoader(ctx: NitroRsbuildContext, name: string): NitroServiceLoader {
  const entry = ctx.services?.[name]?.entry;
  if (!entry) {
    throw new Error(`Service \`${name}\` is not built by Rsbuild.`);
  }
  return ctx.dev ? { import: pathToFileURL(entry).href, bundle: false } : { import: entry };
}

/** Source entry of a service environment (the first module of its first entry). */
function sourceEntry(nitro: Nitro, entry: unknown): string | undefined {
  const value =
    typeof entry === "object" && entry && !Array.isArray(entry)
      ? (entry as { import?: unknown }).import
      : entry;
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first === "string") {
    return first.startsWith(".") ? resolve(nitro.options.rootDir, first) : first;
  }
}

/**
 * Services import the Nitro runtime from the Nitro server: in production, the service output is
 * bundled by Nitro (imports are kept). In development, it is loaded by the dev worker as is, so the
 * runtime modules of the dev server are passed with a global (`__nitro_rsbuild_modules__`).
 */
function nitroRuntimeExternals(ctx: NitroRsbuildContext) {
  return (
    { request }: Rspack.ExternalItemFunctionData,
    callback: (error?: Error, result?: string, type?: Rspack.ExternalsType) => void
  ) => {
    if (!request || !NITRO_RUNTIME_IDS.includes(request)) {
      return callback();
    }
    ctx.runtimeIds.add(request);
    if (ctx.dev) {
      return callback(
        undefined,
        `globalThis.__nitro_rsbuild_modules__[${JSON.stringify(request)}]`,
        "var"
      );
    }
    callback(undefined, request, "module-import");
  };
}

function mergeEnv(env: EnvironmentConfig, overrides: EnvironmentConfig): EnvironmentConfig {
  const externals = env.output?.externals;
  return {
    ...env,
    output: {
      ...env.output,
      ...overrides.output,
      distPath: { ...(env.output?.distPath as object), ...(overrides.output?.distPath as object) },
      filename: { ...env.output?.filename, ...overrides.output?.filename },
      externals: [
        ...(externals ? (Array.isArray(externals) ? externals : [externals]) : []),
        ...((overrides.output?.externals as Rspack.ExternalItem[]) || []),
      ],
    },
    dev: { ...env.dev, ...overrides.dev },
    performance: { ...env.performance, ...overrides.performance },
    tools: {
      ...env.tools,
      rspack: [...toArray(env.tools?.rspack), ...toArray(overrides.tools?.rspack)],
    },
  };
}

function toArray<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}
