import manifest from "../../deps.json" with { type: "json" };

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
 * Optional dependencies installed on demand in the user project (see `utils/dep.ts`), from the
 * `deps.json` manifest (ranges synced with `scripts/sync-deps.ts`).
 *
 * Nitro does not depend on any of them: the version installed next to the app is the version
 * that runs. They are kept external in Nitro's own build (see `build.config.ts`).
 *
 * Optional dependencies of the libraries Nitro bundles are not listed here (see `src/shims/`).
 */
export const deps = manifest.deps satisfies Record<string, DepMeta>;

/** Supported ranges of the optional dependencies of bundled libraries (see `src/shims/`). */
export const shims = manifest.shims satisfies Record<string, { version: string; library: string }>;

export type DepId = keyof typeof deps;

/** Module types of the manifest entries imported with `importDep` (inferred from the `id`). */
export interface DepModules {
  "@rspack/core": typeof import("@rspack/core");
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
