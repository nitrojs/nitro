import type { Nitro } from "nitro/types";
import { builtinModules } from "node:module";
import { resolveModulePath } from "exsolve";
import { resolveAlias } from "pathe/utils";
import { applyLegacyUnenv } from "../config/resolvers/unenv.ts";

export interface BuildEnv {
  alias: Record<string, string>;
  inject: Record<string, string | [id: string, exportName: string]>;
  polyfills: string[];
  external: string[];
}

type BuildEnvInput = Partial<{
  alias: Readonly<Record<string, string>>;
  inject: Readonly<Record<string, string | readonly string[] | false>>;
  polyfills: readonly string[];
  external: readonly string[];
}>;

const commonEnv: BuildEnvInput = {
  alias: {
    "buffer/": "node:buffer",
    "buffer/index": "node:buffer",
    "buffer/index.js": "node:buffer",
    "string_decoder/": "node:string_decoder",
    "process/": "node:process",
  },
};

/**
 * Resolves `alias`, `inject`, `polyfills` and `external` for the bundler.
 *
 * Layers (later wins): Node.js compatibility (`node: false` only), common
 * aliases, then user and preset options. Module ids are resolved to absolute
 * paths so that they don't depend on the importer location.
 */
export async function resolveBuildEnv(nitro: Nitro): Promise<BuildEnv> {
  applyLegacyUnenv(nitro.options);

  const layers: BuildEnvInput[] = [];
  if (nitro.options.node === false) {
    layers.push(await nodeCompatEnv());
  }
  layers.push(commonEnv, {
    alias: nitro.options.alias,
    inject: nitro.options.inject,
    polyfills: nitro.options.polyfills,
    external: nitro.options.external,
  });

  const env = mergeEnv(layers);
  resolveEnvPaths(env, nitro.options.rootDir);
  return env;
}

async function nodeCompatEnv(): Promise<BuildEnvInput> {
  const { defineEnv } = await import("unenv");
  const { env } = defineEnv({ nodeCompat: true });
  return {
    alias: env.alias,
    inject: {
      ...env.inject,
      global: "unenv/polyfill/globalthis",
      process: "node:process",
      Buffer: ["node:buffer", "Buffer"],
      clearImmediate: ["node:timers", "clearImmediate"],
      setImmediate: ["node:timers", "setImmediate"],
      performance: "unenv/polyfill/performance",
      PerformanceObserver: ["node:perf_hooks", "PerformanceObserver"],
      BroadcastChannel: ["node:worker_threads", "BroadcastChannel"],
    },
    polyfills: [
      "unenv/polyfill/globalthis-global",
      "unenv/polyfill/process",
      "unenv/polyfill/buffer",
      "unenv/polyfill/timers",
    ],
  };
}

function mergeEnv(layers: BuildEnvInput[]): BuildEnv {
  const env: BuildEnv = { alias: {}, inject: {}, polyfills: [], external: [] };
  for (const layer of layers) {
    Object.assign(env.alias, layer.alias);
    for (const [name, value] of Object.entries(layer.inject || {})) {
      if (value === false) {
        delete env.inject[name];
      } else {
        env.inject[name] = (typeof value === "string" ? value : [...value]) as string;
      }
    }
    env.polyfills.push(...(layer.polyfills || []).filter(Boolean));
    env.external.push(...(layer.external || []));
  }
  env.polyfills = resolveNegations(env.polyfills);
  env.external = resolveNegations(env.external);
  return env;
}

// Packages resolve from Nitro first (keeps `unenv/*` on Nitro's own version), relative ids from `rootDir`
function resolveEnvPaths(env: BuildEnv, rootDir: string) {
  const resolve = (id: string) => {
    id = resolveAlias(id, env.alias);
    if (id.startsWith("node:")) {
      return id;
    }
    if (builtinModules.includes(id)) {
      return `node:${id}`;
    }
    const from = id.startsWith(".") ? [rootDir] : [import.meta.url, rootDir];
    return resolveModulePath(id, { from, try: true }) || id;
  };
  for (const key in env.alias) {
    env.alias[key] = resolve(env.alias[key]!);
  }
  env.polyfills = env.polyfills.map((id) => resolve(id));
  for (const [name, value] of Object.entries(env.inject)) {
    env.inject[name] = typeof value === "string" ? resolve(value) : [resolve(value[0]), value[1]];
  }
}

// Deduplicates items and removes `!`-prefixed items along with their targets
function resolveNegations(items: string[]): string[] {
  const set = new Set(items);
  for (const item of items) {
    if (item.startsWith("!")) {
      set.delete(item);
      set.delete(item.slice(1));
    }
  }
  return [...set];
}
