import type { Nitro } from "nitropack/types";
import type { Plugin } from "rollup";

/**
 * Rollup plugin to alias 'cloudflare:workers' env imports to globalThis.__env__
 * This is used in development mode to provide access to Cloudflare bindings.
 */
export function cloudflareEnvAlias(nitro: Nitro): Plugin {
  return {
    name: "cloudflare-env-alias",
    resolveId(id) {
      if (id === "cloudflare:workers") {
        return "\0cloudflare-workers-virtual";
      }
      return null;
    },
    load(id) {
      if (id === "\0cloudflare-workers-virtual") {
        return `
export const env = new Proxy({}, {
  get(target, prop) {
    return globalThis.__env__?.[prop];
  },

  has(target, prop) {
    return globalThis.__env__ ? prop in globalThis.__env__ : false;
  },

  ownKeys(target) {
    return globalThis.__env__ ? Object.keys(globalThis.__env__) : [];
  },

  getOwnPropertyDescriptor(target, prop) {
    return globalThis.__env__ ? Object.getOwnPropertyDescriptor(globalThis.__env__, prop) : undefined;
  }
});
`;
      }
      return null;
    },
  };
}
