import type { EnvRunnerPlugin, PluginContext } from "env-runner";
import type { Nitro } from "nitro/types";

import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import replace from "@rollup/plugin-replace";
import { pkgDir } from "nitro/meta";
import { dirname, isAbsolute, join, normalize, resolve } from "pathe";
import { unwasm } from "unwasm/plugin";
import { baseBuildConfig } from "../config.ts";
import { NITRO_VIRTUAL_PREFIX, nitroVirtualPath } from "./entry.ts";
import { importAttributes } from "../plugins/import-attributes.ts";
import { raw, RESOLVED_RE as RAW_RE } from "../plugins/raw.ts";
import { routeMeta } from "../plugins/route-meta.ts";

const SCRIPT_TYPES = ["js", "jsx", "ts", "tsx"] as const;

/**
 * env-runner plugins (run on the host) to load the server sources like a bundled build:
 * extensionless imports, aliases, TypeScript and JSX, `import.meta.*` replacements, raw and
 * WASM imports.
 */
export async function unbundledPlugins(nitro: Nitro): Promise<EnvRunnerPlugin[]> {
  const base = baseBuildConfig(nitro);

  // Sources Nitro would bundle: its own runtime and the app (`node_modules` needs a named include)
  const sourceDirs = [pkgDir, nitro.options.rootDir, ...nitro.options.scanDirs].map(
    (dir) => `${escapeGlob(normalize(dir).replace(/\/$/, ""))}/**`
  );

  const plugins: EnvRunnerPlugin[] = [
    virtualPlugin(),
    resolvePlugin(nitro, base.extensions),
    windowsPathPlugin(base.extensions),
    await transformPlugin(nitro, sourceDirs),
    replacePlugin(base.replacements, sourceDirs),
    withoutSourceMap(fromRollup(await importAttributes())),
    rawVirtualPlugin(nitro),
    fromRollup(raw()),
  ];

  if (Object.keys(base.aliases).length > 0) {
    plugins.push(aliasPlugin(base.aliases, nitro.options.rootDir));
  }

  if (nitro.options.experimental.openAPI) {
    plugins.push(fromRollup(await routeMeta(nitro)));
  }

  if (nitro.options.wasm !== false) {
    plugins.push(fromRollup(unwasm(nitro.options.wasm || {})));
  }

  return plugins;
}

/**
 * Resolve `#nitro/virtual/*` to their path keys.
 *
 * Runtimes resolve them natively to the stub files the keys override, except on miniflare,
 * which only serves the keys for this redirect.
 */
function virtualPlugin(): EnvRunnerPlugin {
  return {
    name: "nitro:virtual",
    resolveId: {
      filter: { id: new RegExp(`^${NITRO_VIRTUAL_PREFIX}`) },
      handler: (source) => nitroVirtualPath(source),
    },
  };
}

/**
 * Resolve imports the runtime fails to resolve (`fallback`), like bundlers do:
 * - relative and absolute paths without extension or to a directory index.
 * - project dependencies imported by Nitro virtual modules (keyed under the Nitro package).
 */
function resolvePlugin(nitro: Nitro, extensions: string[]): EnvRunnerPlugin {
  const virtualDir = nitroVirtualPath("");
  return {
    name: "nitro:resolve",
    resolveId: {
      fallback: true,
      filter: { id: /^(?!#nitro\/)/ },
      handler(this: PluginContext, source, importer) {
        if (/^(?:\.{1,2}\/|\/|[a-zA-Z]:[\\/]|file:)/.test(source)) {
          const [specifier, query] = splitQuery(source);
          const path = specifier.startsWith("file:") ? fileURLToPath(specifier) : specifier;
          const base = isAbsolute(path)
            ? path
            : resolve(importer ? dirname(splitQuery(importer)[0]) : nitro.options.rootDir, path);
          return resolveFile(base, query, extensions);
        }
        if (importer && normalize(importer).startsWith(virtualDir)) {
          return this.resolve(source, join(nitro.options.rootDir, "_"));
        }
      },
    },
  };
}

/**
 * Windows absolute paths (Nitro virtual modules import sources by path): Node.js rejects them
 * as a `d:` URL scheme instead of failing to resolve, so they skip `fallback` resolvers.
 */
function windowsPathPlugin(extensions: string[]): EnvRunnerPlugin {
  return {
    name: "nitro:windows-path",
    resolveId: {
      filter: { id: /^[a-zA-Z]:[\\/]/ },
      handler(source) {
        const [path, query] = splitQuery(source);
        return resolveFile(normalize(path), query, extensions);
      },
    },
  };
}

/** TypeScript and JSX, with the same options as the bundled build. */
async function transformPlugin(nitro: Nitro, sourceDirs: string[]): Promise<EnvRunnerPlugin> {
  const { transformSync } = await import("rolldown/utils");
  const tsc = nitro.options.typescript.tsConfig?.compilerOptions;
  return {
    name: "nitro:transform",
    transform: {
      filter: { id: sourceDirs, moduleType: ["ts", "tsx", "jsx"] },
      handler(this: PluginContext, code, id, { moduleType }) {
        const result = transformSync(id.split("?")[0]!, code, {
          lang: moduleType as "ts" | "tsx" | "jsx",
          sourcemap: true,
          jsx: {
            runtime: tsc?.jsx === "react" ? "classic" : "automatic",
            pragma: tsc?.jsxFactory,
            pragmaFrag: tsc?.jsxFragmentFactory,
            importSource: tsc?.jsxImportSource,
            development: nitro.options.dev,
          },
        });
        if (result.errors.length > 0) {
          this.error(result.errors.map((error) => error.message).join("\n"));
        }
        return { code: result.code, map: result.map as any, moduleType: "js" };
      },
    },
  };
}

/**
 * Raw imports of virtual modules (`text:#nitro/virtual/...`) inline their rendered source.
 *
 * Runs before the raw plugin, which would read the stub file behind the path key instead
 * (bundlers keep virtual ids, for which it uses `this.load()`, unsupported by env-runner).
 */
function rawVirtualPlugin(nitro: Nitro): EnvRunnerPlugin {
  const prefixRe = /^(raw|bytes|text):/;
  return {
    name: "nitro:raw-virtual",
    resolveId: {
      order: "pre",
      filter: { id: [/^raw:/, /^bytes:/, /^text:/] },
      handler(source) {
        const [, type] = prefixRe.exec(source) || [];
        const id = source.slice(`${type}:`.length);
        if (type && nitro.vfs.has(id)) {
          return `virtual:nitro:${type}:${id}.js`;
        }
      },
    },
    load: {
      order: "pre",
      filter: { id: RAW_RE },
      async handler(id) {
        const [, type] = RAW_RE.exec(id) || [];
        const vfsId = id.replace(RAW_RE, "").slice(0, -".js".length);
        const mod = nitro.vfs.get(vfsId);
        if (!mod) {
          return;
        }
        const code = await mod.render();
        return type === "bytes" ? Buffer.from(code, "utf8").toString("binary") : code;
      },
    },
  };
}

/** `import.meta.*` and `replace` values (line-preserving, so without a source map). */
function replacePlugin(
  values: ReturnType<typeof baseBuildConfig>["replacements"],
  sourceDirs: string[]
): EnvRunnerPlugin {
  const plugin = (replace as unknown as typeof replace.default)({
    preventAssignment: true,
    sourceMap: false,
    values,
  });
  const keys = Object.keys(values).map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return {
    name: "nitro:replace",
    transform: {
      order: "post",
      filter: {
        id: { include: sourceDirs, exclude: RAW_RE },
        moduleType: [...SCRIPT_TYPES],
        code: new RegExp(keys.join("|")),
      },
      handler: plugin.transform as any,
    },
  };
}

/** `alias` option (and unenv aliases), resolved like bundlers do (relative targets from `rootDir`). */
function aliasPlugin(_aliases: Record<string, string>, rootDir: string): EnvRunnerPlugin {
  const aliases = Object.fromEntries(
    Object.entries(_aliases).map(([key, target]) => [
      key,
      /^\.{1,2}\//.test(target) ? resolve(rootDir, target) : target,
    ])
  );
  const keys = Object.keys(aliases).map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return {
    name: "nitro:alias",
    resolveId: {
      filter: { id: new RegExp(`^(?:${keys.join("|")})`) },
      async handler(this: PluginContext, source, importer) {
        for (const [key, target] of Object.entries(aliases)) {
          if (source !== key && !source.startsWith(key.endsWith("/") ? key : `${key}/`)) {
            continue;
          }
          const aliased = target + source.slice(key.length);
          return (await this.resolve(aliased, importer)) ?? { id: aliased, external: true };
        }
      },
    },
  };
}

/**
 * Drop the source map of a line-preserving transform: env-runner does not compose maps, so a
 * second one (from `nitro:transform`) would drop both.
 */
function withoutSourceMap(plugin: EnvRunnerPlugin): EnvRunnerPlugin {
  const transform = plugin.transform as Exclude<
    NonNullable<EnvRunnerPlugin["transform"]>,
    Function
  >;
  return {
    ...plugin,
    transform: {
      ...transform,
      async handler(...args) {
        const result = await transform.handler.apply(this, args);
        return result && typeof result === "object" ? { ...result, map: undefined } : result;
      },
    },
  };
}

/** Rollup plugins only using the hooks and context env-runner supports. */
function fromRollup(plugin: unknown): EnvRunnerPlugin {
  return plugin as EnvRunnerPlugin;
}

/** The path itself, with an extension or as a directory index, like bundlers resolve it. */
function resolveFile(base: string, query: string, extensions: string[]): string | undefined {
  for (const candidate of [
    base,
    ...extensions.map((ext) => base + ext),
    ...extensions.map((ext) => join(base, `index${ext}`)),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate + query;
    }
  }
}

function splitQuery(id: string): [path: string, query: string] {
  const index = id.indexOf("?");
  return index === -1 ? [id, ""] : [id.slice(0, index), id.slice(index)];
}

function escapeGlob(path: string) {
  return path.replace(/[*?[\]{}!\\]/g, "\\$&");
}
