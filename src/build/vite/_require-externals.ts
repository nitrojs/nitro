import type { Plugin as VitePlugin } from "vite";
import { isBuiltin } from "node:module";

const FACADE_PREFIX = "\0nitro-require-external:";

/**
 * Service environments (e.g. SSR) keep their dependencies external, and Nitro bundles them in
 * its own build. A `require()` of one of them from bundled CommonJS would be emitted as a
 * runtime `createRequire()` call that the Nitro build cannot follow, leaving it unresolved (or
 * loading a second instance) at runtime. It is turned into an ESM import instead, the same way
 * as rolldown's `esmExternalRequirePlugin` but for any dependency Vite resolves as external.
 */
export function nitroRequireExternals(): VitePlugin {
  return {
    name: "nitro:require-externals",
    apply: "build",
    applyToEnvironment: (env) => env.name !== "nitro" && env.config.consumer === "server",

    resolveId: {
      order: "pre",
      // Bare specifiers only (`kind` cannot be filtered natively)
      filter: { id: /^[\w@][^:]*$/ },
      async handler(id, importer, options) {
        if (importer?.startsWith(FACADE_PREFIX)) {
          return { id, external: true };
        }
        if (options.kind !== "require-call" || isBuiltin(id)) {
          return;
        }
        const resolved = await this.resolve(id, importer, { ...options, skipSelf: true });
        if (resolved?.external) {
          return FACADE_PREFIX + resolved.id;
        }
      },
    },

    load: {
      filter: { id: /^\0nitro-require-external:/ },
      handler(id) {
        const source = JSON.stringify(id.slice(FACADE_PREFIX.length));
        return [
          `import * as m from ${source};`,
          `module.exports = Object.prototype.hasOwnProperty.call(m, "module.exports") ? m["module.exports"] : { ...m };`,
        ].join("\n");
      },
    },
  };
}
