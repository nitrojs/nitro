import type { Nitro } from "nitro/types";
import type { Plugin } from "rollup";
import { pkgDir } from "nitro/meta";
import { DB0_VERSION } from "../../utils/database.ts";
import { ensureDep, resolveDep } from "../../utils/dep.ts";
import { pathRegExp } from "../../utils/regex.ts";
import { UNSTORAGE_VERSION } from "../../utils/storage.ts";

/** Runtime dependencies of opt-in features, installed in the project on demand. */
const optionalRuntimeDeps: Record<string, { version: string; reason: string }> = {
  unstorage: { version: UNSTORAGE_VERSION, reason: "KV storage (`nitro/kv`)" },
  db0: { version: DB0_VERSION, reason: "the database layer (`nitro/database`)" },
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
 * prompting to install it if missing.
 */
export async function ensureRuntimeDep(nitro: Nitro, id: string): Promise<void> {
  const name = id.split("/")[0]!;
  const { version, reason } = optionalRuntimeDeps[name]!;
  const resolved = await ensureDep({
    id: name,
    version,
    dir: nitro.options.rootDir,
    reason,
    dev: false,
  });
  if (!resolved) {
    throw new Error(
      `\`${name}\` is not installed. It is required for ${reason}. Please add it to your dependencies (e.g. \`npx nypm add ${name}@${version}\`).`
    );
  }
}

/**
 * Resolves optional runtime dependencies (`unstorage`, `db0`) imported by the Nitro runtime.
 *
 * They are not dependencies of Nitro: they are resolved from the project and only installed
 * once a build actually imports them (e.g. `nitro/kv` or `nitro/database` is used).
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
          throw new Error(
            `Cannot resolve \`${id}\` from \`${nitro.options.rootDir}\`. Please make sure \`${id.split("/")[0]}\` is installed in your project.`
          );
        }
        return (await this.resolve(path, importer, { ...options, skipSelf: true })) || path;
      },
    },
  };
}
