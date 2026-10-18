import type { Nitro } from "nitro/types";
import type { Plugin } from "rollup";
import { pkgDir } from "#nitro/meta";
import { DB0_VERSION } from "../../utils/database.ts";
import { ensureDep, missingDepError, resolveDep } from "../../utils/dep.ts";
import { pathRegExp } from "../../utils/regex.ts";
import { UNSTORAGE_VERSION } from "../../utils/storage.ts";

/** Supported `ocache` version range (installed on demand). */
const OCACHE_VERSION = "^0.3.0";

/** Runtime dependencies of opt-in features, installed in the project on demand. */
const optionalRuntimeDeps: Record<string, { version: string; reason: string }> = {
  unstorage: { version: UNSTORAGE_VERSION, reason: "KV storage (`nitro/kv`)" },
  db0: { version: DB0_VERSION, reason: "the database layer (`nitro/database`)" },
  ocache: { version: OCACHE_VERSION, reason: "caching (`nitro/cache` or `cache` route rules)" },
};

/** Matches imports of optional runtime dependencies (and their subpaths). */
export const OPTIONAL_RUNTIME_DEPS_RE: RegExp = new RegExp(
  `^(${Object.keys(optionalRuntimeDeps).join("|")})(\\/|$)`
);

const RUNTIME_IMPORTER_RE = new RegExp(`^(#nitro/|\0|${pathRegExp(pkgDir)}(?!.*node_modules))`);

/** Whether a module is part of the Nitro runtime (or a Nitro virtual module). */
export function isRuntimeImporter(importer: string | undefined): boolean {
  return !!importer && RUNTIME_IMPORTER_RE.test(importer);
}

/**
 * Ensure an optional runtime dependency imported as `id` is installed in the project,
 * installing it (without prompting) if missing.
 */
export async function ensureRuntimeDep(nitro: Nitro, id: string): Promise<void> {
  const name = id.split("/")[0]!;
  const opts = {
    id: name,
    ...optionalRuntimeDeps[name]!,
    dir: nitro.options.rootDir,
    dev: false,
    autoInstall: true,
  };
  if (!(await ensureDep(opts))) {
    throw missingDepError(opts);
  }
}

/**
 * Resolves optional runtime dependencies (`unstorage`, `db0`, `ocache`) imported by the Nitro runtime.
 *
 * They are not dependencies of Nitro: they are resolved from the project and only installed
 * once a build actually imports them (e.g. `nitro/kv`, `nitro/database` or `nitro/cache` is used).
 */
export function runtimeDeps(nitro: Nitro): Plugin {
  return {
    name: "nitro:runtime-deps",
    resolveId: {
      order: "pre",
      filter: { id: OPTIONAL_RUNTIME_DEPS_RE },
      async handler(id, importer, options) {
        // Imports from user code and dependencies keep their regular resolution
        if (!isRuntimeImporter(importer)) {
          return;
        }
        await ensureRuntimeDep(nitro, id);
        const path = resolveDep(id, { dir: nitro.options.rootDir });
        if (!path) {
          const name = id.split("/")[0]!;
          throw new Error(
            `Cannot resolve \`${id}\` from \`${nitro.options.rootDir}\`. Please make sure \`${name}@${optionalRuntimeDeps[name]!.version}\` is installed in your project.`
          );
        }
        return (await this.resolve(path, importer, { ...options, skipSelf: true })) || path;
      },
    },
  };
}
