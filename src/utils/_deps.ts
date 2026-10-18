export interface DepMeta {
  /**
   * Supported version range, used when installing (ignored if it is not a simple range)
   * and checked against the version of an already installed package.
   */
  version: string;
  /** Human readable reason, used in prompts and errors (can be overridden per call). */
  reason: string;
  /** Install as a dev dependency. (default: `true`) */
  dev?: boolean;
  /** Install without prompting, also in interactive environments (never in test mode). */
  autoInstall?: boolean;
  /** Only resolve from the project, ignoring Nitro's own dependencies. */
  projectOnly?: boolean;
  /** Imported by the Nitro runtime: resolved from the project and installed when the app bundle imports it. */
  runtime?: boolean;
  /** Imported by the public types, with a fallback type when not installed (see `OptionalDepType`). */
  types?: boolean;
}

/**
 * Optional dependencies installed on demand in the user project (see `utils/dep.ts`).
 *
 * Nitro does not depend on any of them: the version installed next to the app is the version
 * that runs. They are kept external in Nitro's own build (see `build.config.ts`).
 *
 * Optional dependencies of the libraries Nitro bundles are not listed here (see `src/shims/`).
 */
export const deps = {
  // Builders
  rolldown: { version: "^1", reason: "the `rolldown` builder", types: true },
  rollup: { version: "^4", reason: "the `rollup` builder", types: true },
  vite: { version: "^8", reason: "the `vite` builder" },

  // Runtime
  unstorage: {
    version: "^2.0.0-alpha.10",
    reason: "KV storage (`nitro/kv`)",
    dev: false,
    autoInstall: true,
    runtime: true,
    types: true,
  },
  db0: {
    version: "^0.4.1",
    reason: "the database layer (`nitro/database`)",
    dev: false,
    autoInstall: true,
    runtime: true,
    types: true,
  },
  ocache: {
    version: "^0.3.0",
    reason: "caching (`nitro/cache` or `cache` route rules)",
    dev: false,
    autoInstall: true,
    runtime: true,
    types: true,
  },
  unenv: { version: "^2.0.0-rc.24", reason: "Node.js compatibility", autoInstall: true },

  // Dev
  miniflare: { version: "^4", reason: "the `miniflare` dev runner" },

  // Presets
  "@azure/functions": {
    version: "^4",
    reason: "the Azure Functions v4 programming model",
    dev: false,
    projectOnly: true,
  },
  "@vercel/queue": { version: "^0.8.0", reason: "Vercel Queues", types: true },
  xml2js: { version: "^0.6.2", reason: "merging a custom `web.config` for the IIS preset" },
  "zephyr-agent": { version: "^1.6.0", reason: "deploying to Zephyr" },
} satisfies Record<string, DepMeta>;

export type DepId = keyof typeof deps;

/** Module types of the manifest entries imported with `importDep` (inferred from the `id`). */
export interface DepModules {
  "@vercel/queue": typeof import("@vercel/queue");
  db0: typeof import("db0");
  rollup: typeof import("rollup");
  unstorage: typeof import("unstorage");
  vite: typeof import("vite");
  xml2js: typeof import("xml2js");
  "zephyr-agent": typeof import("zephyr-agent");
}

export function getDepMeta(id: string): DepMeta | undefined {
  return Object.hasOwn(deps, id) ? deps[id as DepId] : undefined;
}
