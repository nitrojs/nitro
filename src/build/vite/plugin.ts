import type { ConfigEnv, PluginOption as VitePlugin } from "vite";
import type { InputOption, Plugin as RollupPlugin } from "rollup";
import type { NitroPluginConfig, NitroPluginContext } from "./types";
import { resolve, relative, join } from "pathe";
import { createNitro, prepare } from "../..";
import { getViteRollupConfig } from "./rollup";
import { buildEnvironments, prodSetup } from "./prod";
import {
  createDevWorker,
  createNitroEnvironment,
  createServiceEnvironments,
} from "./env";
import { configureViteDevServer } from "./dev";
import { runtimeDependencies, runtimeDir } from "nitro/runtime/meta";
import { resolveModulePath } from "exsolve";
import { prettyPath } from "../../utils/fs";
import { NitroDevApp } from "../../dev/app";
import { nitroPreviewPlugin } from "./preview";
import { existsSync } from "node:fs";

// https://vite.dev/guide/api-environment-plugins
// https://vite.dev/guide/api-environment-frameworks.html

const DEFAULT_EXTENSIONS = [".ts", ".js", ".mts", ".mjs", ".tsx", ".jsx"];

export async function nitro(
  pluginConfig: NitroPluginConfig = {}
): Promise<VitePlugin> {
  const ctx: NitroPluginContext = {
    nitro: undefined!,
    rollupConfig: undefined!,
    pluginConfig,
    _entryPoints: {},
    _manifest: {},
    _serviceBundles: {},
  };

  const configEnv = inferConfigEnv();
  const rootDir = inferRoot();
  ctx.nitro =
    pluginConfig._nitro ||
    (await createNitro({
      dev: configEnv.mode === "development",
      rootDir,
      ...pluginConfig.config,
    }));

  ctx.rollupConfig = await getViteRollupConfig(ctx);

  let rollupDevPlugins: VitePlugin[] = [];
  if (ctx.nitro.options.dev) {
    await ctx.nitro.hooks.callHook(
      "rollup:before",
      ctx.nitro,
      ctx.rollupConfig.config
    );
    rollupDevPlugins = ctx.rollupConfig.config.plugins as VitePlugin[];
  }

  return [
    nitroPlugin(ctx),
    nitroServicePlugin(ctx),
    nitroPreviewPlugin(ctx),
    ...rollupDevPlugins,
  ];
}

function nitroPlugin(ctx: NitroPluginContext): VitePlugin[] {
  return [
    {
      name: "nitro:main",

      // Opt-in this plugin into the shared plugins pipeline
      sharedDuringBuild: true,

      // Only apply this plugin during build or dev
      apply: (config, configEnv) => !configEnv.isPreview,

      // Extend vite config before it's resolved
      async config(userConfig, configEnv) {
        // Config ssr env as a fetchable ssr service
        if (!ctx.pluginConfig.services?.ssr) {
          ctx.pluginConfig.services ??= {};
          if (userConfig.environments?.ssr === undefined) {
            const ssrEntry = resolveModulePath("./entry-server", {
              from: ["", "app", "src"].flatMap((d) =>
                ctx.nitro!.options.scanDirs.map((s) => join(s, d) + "/")
              ),
              extensions: DEFAULT_EXTENSIONS,
              try: true,
            });
            if (ssrEntry) {
              ctx.pluginConfig.services.ssr = { entry: ssrEntry };
              ctx.nitro!.logger.info(
                `Using \`${prettyPath(ssrEntry)}\` as vite ssr entry.`
              );
            }
          } else {
            let ssrEntry = getEntry(
              userConfig.environments.ssr.build?.rollupOptions?.input
            );
            if (typeof ssrEntry === "string") {
              ssrEntry =
                resolveModulePath(ssrEntry, {
                  from: ctx.nitro.options.scanDirs,
                  extensions: DEFAULT_EXTENSIONS,
                  suffixes: ["", "/index"],
                  try: true,
                }) || ssrEntry;
              ctx.pluginConfig.services.ssr = { entry: ssrEntry };
            } else {
              this.error(`Invalid input type for SSR entry point.`);
            }
          }
        }

        // Default SSR renderer
        if (
          !ctx.nitro.options.renderer?.entry &&
          !ctx.nitro.options.renderer?.template &&
          ctx.pluginConfig.services.ssr?.entry
        ) {
          ctx.nitro.options.renderer ??= {};
          ctx.nitro.options.renderer.entry = resolve(
            runtimeDir,
            "internal/vite/ssr-renderer"
          );
        }

        // Determine default Vite dist directory
        const publicDistDir = (ctx._publicDistDir =
          userConfig.build?.outDir ||
          resolve(ctx.nitro.options.buildDir, "vite/public"));
        ctx.nitro.options.publicAssets.push({
          dir: publicDistDir,
          maxAge: 0,
          baseURL: "/",
          fallthrough: true,
        });

        // Nitro Vite Production Runtime
        if (!ctx.nitro.options.dev) {
          ctx.nitro.options.unenv.push({
            meta: { name: "nitro-vite" },
            polyfill: ["#nitro-vite-setup"],
          });
        }

        // Call build:before hook **before resolving rollup config** for compatibility
        await ctx.nitro.hooks.callHook("build:before", ctx.nitro);

        // Create dev worker
        if (ctx.nitro.options.dev && !ctx.devWorker) {
          ctx.devWorker = createDevWorker(ctx);
        }

        // Create dev app
        if (ctx.nitro.options.dev && !ctx.devApp) {
          ctx.devApp = new NitroDevApp(ctx.nitro);
        }

        return {
          // Don't include HTML middlewares
          appType: userConfig.appType || "custom",

          // Add Nitro as a Vite environment
          environments: {
            client: {
              consumer: userConfig.environments?.client?.consumer ?? "client",
              build: {
                rollupOptions: {
                  input:
                    userConfig.environments?.client?.build?.rollupOptions
                      ?.input ?? ctx.nitro.options.renderer?.template,
                },
              },
            },
            ...createServiceEnvironments(ctx),
            nitro: createNitroEnvironment(ctx),
          },

          resolve: {
            // TODO: environment specific aliases not working
            // https://github.com/vitejs/vite/pull/17583 (seems not effective)
            alias: ctx.rollupConfig.base.aliases,
          },

          build: {
            // TODO: Support server environment emitted assets
            assetsInlineLimit: 4096 * 4,
          },

          builder: {
            /// Share the config instance among environments to align with the behavior of dev server
            sharedConfigBuild: true,
          },

          server: {
            port:
              Number.parseInt(process.env.PORT || "") ||
              userConfig.server?.port ||
              ctx.nitro.options.devServer?.port ||
              3000,
          },
        };
      },

      configResolved(config) {
        if (config.command === "build") {
          // Add cache-control to immutable client assets
          for (const env of Object.values(config.environments)) {
            if (env.consumer === "client") {
              const { assetsDir } = env.build;
              const rule = (ctx.nitro!.options.routeRules[
                `/${assetsDir}/**`
              ] ??= {});
              if (!rule.headers?.["cache-control"]) {
                rule.headers = {
                  ...rule.headers,
                  "cache-control": `public, max-age=31536000, immutable`,
                };
              }
            }
          }
        }

        // Refresh nitro routes
        ctx.nitro!.routing.sync();
      },

      buildApp: {
        order: "post",
        handler(builder) {
          return buildEnvironments(ctx, builder);
        },
      },

      generateBundle: {
        handler(_options, bundle) {
          const { root } = this.environment.config;
          const services = ctx.pluginConfig.services || {};
          const serviceNames = Object.keys(services);
          const isRegisteredService = serviceNames.includes(
            this.environment.name
          );

          // find entry point of this service
          let entryFile: string | undefined;
          for (const [_name, file] of Object.entries(bundle)) {
            if (file.type === "chunk") {
              if (isRegisteredService && file.isEntry) {
                if (entryFile !== undefined) {
                  this.error(
                    `Multiple entry points found for service "${this.environment.name}". Only one entry point is allowed.`
                  );
                }
                entryFile = file.fileName;
              }
              const filteredModuleIds = file.moduleIds.filter((id) =>
                id.startsWith(root)
              );
              for (const id of filteredModuleIds) {
                const originalFile = relative(root, id);
                ctx._manifest[originalFile] = { file: file.fileName };
              }
            }
          }
          if (isRegisteredService) {
            if (entryFile === undefined) {
              this.error(
                `No entry point found for service "${this.environment.name}".`
              );
            }
            ctx._entryPoints![this.environment.name] = entryFile!;
            ctx._serviceBundles[this.environment.name] = bundle;
          }
        },
      },

      // Modify environment configs before it's resolved.
      configEnvironment(name, config) {
        if (config.consumer === "client") {
          config.build!.emptyOutDir = false;
          config.build!.outDir = ctx.nitro!.options.output.publicDir;
        }

        const services = ctx.pluginConfig.services || {};
        const serviceNames = Object.keys(services);
        if (
          serviceNames.includes(name) &&
          ctx.pluginConfig.experimental?.virtualBundle
        ) {
          config.build ??= {};
          config.build.write = config.build.write ?? false;
        }
      },

      // Extend Vite dev server with Nitro middleware
      configureServer: (server) => configureViteDevServer(ctx, server),
    },
    {
      name: "nitro:prepare",
      buildApp: {
        // clean the output directory before any environment is built
        order: "pre",
        async handler() {
          const nitro = ctx.nitro!;
          await prepare(nitro);
        },
      },
    },
  ];
}

function nitroServicePlugin(ctx: NitroPluginContext): VitePlugin {
  return {
    name: "nitro:service",

    enforce: "pre",

    // Only apply this plugin to the nitro environment
    applyToEnvironment: (env) => env.name === "nitro",

    resolveId: {
      async handler(id, importer, options) {
        // Virtual modules
        if (id === "#nitro-vite-setup") {
          return { id, moduleSideEffects: true };
        }
        if (id === "#nitro-vite-services") {
          return id;
        }

        // Resolve built-in deps
        if (
          runtimeDependencies.some(
            (dep) => id === dep || id.startsWith(`${dep}/`)
          )
        ) {
          const resolved = await this.resolve(id, importer, {
            ...options,
            skipSelf: true,
          });
          return (
            resolved ||
            resolveModulePath(id, {
              from: ctx.nitro!.options.nodeModulesDirs,
              conditions: ctx.nitro!.options.exportConditions,
              try: true,
            })
          );
        }

        // Resolve relative paths from virtual modules
        if (importer?.startsWith("\0virtual:#nitro-internal-virtual")) {
          const internalRes = await this.resolve(id, import.meta.url, {
            ...options,
            custom: { ...options.custom, skipNoExternals: true },
          });
          if (internalRes) {
            return internalRes;
          }
          const resolvedFromRoot = await this.resolve(
            id,
            ctx.nitro!.options.rootDir,
            { ...options, custom: { ...options.custom, skipNoExternals: true } }
          );
          if (resolvedFromRoot) {
            return resolvedFromRoot;
          }
          const ids = [id];
          if (!/^[./@#]/.test(id)) {
            ids.push(`./${id}`);
          }
          for (const _id of ids) {
            const resolved = resolveModulePath(_id, {
              from: process.cwd(),
              extensions: DEFAULT_EXTENSIONS,
              suffixes: ["", "/index"],
              try: true,
            });
            if (resolved) {
              return resolved;
            }
          }
        }
      },
    },

    load: {
      async handler(id) {
        // Virtual modules
        if (id === "#nitro-vite-setup") {
          return prodSetup(ctx);
        }
      },
    },
  };
}

// --- internal helpers ---

function inferConfigEnv(): ConfigEnv {
  const isDev = process.env.NODE_ENV
    ? process.env.NODE_ENV === "development"
    : process.argv.includes("dev");

  return {
    mode: isDev ? "development" : "production",
    command: isDev ? "serve" : "build",
    isSsrBuild: !isDev && process.argv.includes("--ssr"),
    isPreview: !isDev && process.argv.includes("preview"),
  };
}

function inferRoot() {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  const lastArg = args.at(-1);
  const resolvedDir = resolve(lastArg || ".");
  return existsSync(resolvedDir) ? resolvedDir : process.cwd();
}

function getEntry(input: InputOption | undefined): string | undefined {
  if (typeof input === "string") {
    return input;
  } else if (Array.isArray(input) && input.length > 0) {
    return input[0];
  } else if (input && "index" in input) {
    return input.index as string;
  }
}
