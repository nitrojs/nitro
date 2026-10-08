import type { NitroPluginContext } from "./types.ts";
import type { Plugin as VitePlugin } from "vite";
import { resolve } from "pathe";

export function viteServicesTemplate(ctx: NitroPluginContext): string {
  const serviceNames = Object.keys(ctx.services);

  // Dev worker registers the services. Vitest runs without it: entries are imported from the
  // nitro environment instead.
  if (ctx.nitro!.options.dev && !ctx._isVitest) {
    return /* js */ `
export const viteServices = {
${serviceNames
  .map(
    (name) =>
      `  get [${JSON.stringify(name)}]() { return globalThis.__nitro_vite_envs__[${JSON.stringify(name)}] }`
  )
  .join(",\n")}
};
  `;
  }

  const serviceEntries = serviceNames.map((name) => {
    const entry = ctx._isVitest
      ? _resolveServiceEntry(ctx, ctx.services[name].entry)
      : resolve(ctx.nitro!.options.buildDir, "vite/services", name, ctx._entryPoints[name]);
    return [name, entry];
  });

  return /* js */ `
function lazyService(name, loader) {
  let promise, mod
  return {
    fetch(req) {
      if (mod) { return mod.fetch(req) }
      if (!promise) {
        promise = loader().then(_mod => {
          const m = typeof _mod.default?.fetch === "function" ? _mod.default : _mod
          if (typeof m.fetch !== "function") {
            throw new TypeError(\`[nitro] Vite service "\${name}" entry does not export a \\\`fetch\\\` handler.\`)
          }
          return (mod = m)
        })
      }
      return promise.then(mod => mod.fetch(req))
    }
  }
}

export const viteServices = {
${serviceEntries
  .map(
    ([name, entry]) =>
      `[${JSON.stringify(name)}]: lazyService(${JSON.stringify(name)}, () => import(${JSON.stringify(entry)}))`
  )
  .join(",\n")}
};
  `;
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

function _resolveServiceEntry(ctx: NitroPluginContext, entry: string): string {
  return entry.startsWith(".") ? resolve(ctx.nitro!.options.rootDir, entry) : entry;
}
