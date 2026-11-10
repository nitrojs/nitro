import type { NitroServiceLoader } from "nitro/types";
import type { NitroPluginContext } from "./types.ts";
import type { Plugin as VitePlugin } from "vite";
import { readFile } from "node:fs/promises";
import { join, resolve } from "pathe";

// Written next to each service output so a later build that skips it (`isBuilt`) finds its entry.
export const SERVICE_MANIFEST_FILE = "nitro-service.json";

// Without a manifest (e.g. output of an older Nitro), the output dir itself is imported (`index.{mjs,js}`).
export async function readBuiltServiceEntry(outDir: string): Promise<string | undefined> {
  try {
    const { entry } = JSON.parse(await readFile(join(outDir, SERVICE_MANIFEST_FILE), "utf8"));
    return typeof entry === "string" ? entry : undefined;
  } catch {
    return undefined;
  }
}

/** How the server loads the output of a service (see `nitro._serviceLoader`). */
export function viteServiceLoader(ctx: NitroPluginContext, name: string): NitroServiceLoader {
  // Dev worker registers the services. Vitest runs without it: entries are imported from the
  // nitro environment instead.
  if (ctx._isVitest) {
    return { import: ctx.services[name].entry };
  }
  if (ctx.nitro!.options.dev) {
    return { expression: `globalThis.__nitro_vite_envs__[${JSON.stringify(name)}]` };
  }
  return {
    import: resolve(ctx.nitro!.options.buildDir, "vite/services", name, ctx._entryPoints[name]),
  };
}

// Service environments (e.g. SSR) must not bundle their own copy of `nitro/*`
// runtime modules. In dev, imports are proxied to the Nitro environment via
// __VITE_ENVIRONMENT_RUNNER_IMPORT__. In prod, they are externalized (see createServiceEnvironment).
const NITRO_PROXY_PREFIX = "\0nitro-env-proxy:";
// Vitest runs no dev worker to proxy to: test files import `nitro/*` from the nitro environment.
export function nitroDevServiceProxy(ctx: NitroPluginContext): VitePlugin {
  return {
    name: "nitro:dev-service-proxy",
    enforce: "pre",
    applyToEnvironment: (env) =>
      !ctx._isVitest && env.name !== "nitro" && env.config.consumer === "server",
    apply: (_config, configEnv) => configEnv.command === "serve",

    resolveId: {
      filter: { id: /^nitro(\/|$)/ },
      handler(id) {
        if (id === "nitro" || id.startsWith("nitro/")) {
          return { id: NITRO_PROXY_PREFIX + id, moduleSideEffects: false };
        }
      },
    },

    load: {
      filter: { id: /^\0nitro-env-proxy:/ },
      handler(id) {
        if (!id.startsWith(NITRO_PROXY_PREFIX)) {
          return;
        }
        const originalId = id.slice(NITRO_PROXY_PREFIX.length);
        // __vite_ssr_exportAll__ is provided by the module runner execution context.
        // It re-exports all enumerable own properties (except "default") from the source module.
        return {
          code: [
            `const _mod = await globalThis.__VITE_ENVIRONMENT_RUNNER_IMPORT__("nitro", ${JSON.stringify(originalId)});`,
            `__vite_ssr_exportAll__(_mod);`,
            `export default _mod.default;`,
          ].join("\n"),
          map: null,
        };
      },
    },
  };
}
