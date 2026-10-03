import consola from "consola";
import { isAbsolute, resolve } from "pathe";
import type { NitroOptions } from "nitro/types";
import { resolveStorageMounts } from "../../utils/storage.ts";

const cacheDrivers = new Set(["memory", "fs", "kv"]);

export async function resolveCacheOptions(options: NitroOptions) {
  options.cache ??= {};

  // Backward compatibility: a `cache` KV mount point keeps cache entries in KV storage
  options.cache.driver ??= hasCacheKVMount(options) ? "kv" : "memory";

  if (!cacheDrivers.has(options.cache.driver)) {
    throw new Error(
      `Invalid \`cache.driver\`: ${JSON.stringify(options.cache.driver)}. Expected one of: ${[...cacheDrivers].map((d) => `"${d}"`).join(", ")}.`
    );
  }

  if (options.cache.driver === "fs") {
    if (!options.node) {
      consola.warn(
        `\`cache.driver: "fs"\` requires a Node.js compatible runtime, but the \`${options.preset}\` preset does not target Node.js. Use \`"memory"\` or \`"kv"\` instead.`
      );
    }
    const dir = options.cache.fs?.dir || ".data/cache";
    const isDevOrPrerender = options.dev || options.preset === "nitro-prerender";
    options.cache.fs = {
      ...options.cache.fs,
      dir: isDevOrPrerender && !isAbsolute(dir) ? resolve(options.rootDir, dir) : dir,
    };
  }
}

function hasCacheKVMount(options: NitroOptions): boolean {
  return resolveStorageMounts(options).some(({ path }) => {
    const base = path.replace(/[/\\]/g, ":").replace(/^:+/, "");
    return base === "cache" || base.startsWith("cache:");
  });
}
