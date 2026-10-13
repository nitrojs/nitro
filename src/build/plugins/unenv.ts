import type { Nitro } from "nitro/types";
import type { Plugin } from "rollup";
import { resolveModulePath } from "exsolve";
import type { BuildEnv } from "../env.ts";
import { ensureDep } from "../../utils/dep.ts";
import { escapeRegExp } from "../../utils/regex.ts";

const UNENV_VERSION = "^2.0.0-rc.24";

/** Whether a module id refers to an `unenv` polyfill. */
export function isUnenvId(id: string | undefined): boolean {
  return !!id?.startsWith("unenv/");
}

/**
 * Resolves `unenv` polyfills (and the modules aliased to them) on demand.
 *
 * `unenv` is not a dependency of Nitro: it is resolved from the project and
 * only installed once a build actually bundles one of its polyfills.
 */
export function unenv(nitro: Nitro, env: BuildEnv): Plugin {
  const aliases = new Map(Object.entries(env.alias).filter(([, to]) => isUnenvId(to)));
  let installed: Promise<boolean> | undefined;

  const ensureUnenv = async (id: string) => {
    const reason = `Node.js compatibility (\`${id}\` import with the \`${nitro.options.preset}\` preset)`;
    installed ??= ensureDep({
      id: "unenv",
      version: UNENV_VERSION,
      dir: nitro.options.rootDir,
      reason,
    }).then((resolved) => !!resolved);
    if (!(await installed)) {
      throw new Error(
        `\`unenv\` is not installed. It is required for ${reason}. Please add it to your dev dependencies (e.g. \`npx nypm add -D unenv\`).`
      );
    }
  };

  return {
    name: "nitro:unenv",
    async buildStart() {
      // Polyfills are always bundled: install before modules are loaded rather than mid-build
      const required = env.polyfills.find((id) => isUnenvId(id)) || aliases.has("node:process");
      if (required) {
        await ensureUnenv(typeof required === "string" ? required : "node:process");
      }
    },
    resolveId: {
      order: "pre",
      filter: {
        id: new RegExp(
          `^(unenv/|(${[...aliases.keys()].map((id) => escapeRegExp(id)).join("|")})$)`
        ),
      },
      async handler(id, importer, options) {
        const target = aliases.get(id);
        if (!target) {
          if (!isUnenvId(id)) {
            return;
          }
          // Direct imports of `unenv` keep their regular resolution (e.g. a dependency's own copy)
          let resolved: Awaited<ReturnType<typeof this.resolve>>;
          try {
            resolved = await this.resolve(id, importer, { ...options, skipSelf: true });
          } catch (error: any) {
            if (error?.code === "ENOTDIR") {
              throw new Error(
                `Cannot resolve "${id}" — the package may be missing an export condition for this subpath.\n` +
                  `Tip: Add an alias in your nitro config:\n` +
                  `  alias: { '${id}': '/path/to/correct-file' }`,
                { cause: error }
              );
            }
            throw error;
          }
          if (resolved) {
            return resolved;
          }
        }
        await ensureUnenv(id);
        const path = resolveModulePath(target || id, {
          from: [nitro.options.rootDir, import.meta.url],
          try: true,
        });
        if (!path) {
          throw new Error(
            `Cannot resolve \`${target || id}\` (for \`${id}\`). Please make sure \`unenv@${UNENV_VERSION}\` is installed in your project.`
          );
        }
        // Resolve the polyfill through other plugins as well (CommonJS interop, side effects)
        try {
          return (await this.resolve(path, importer, { ...options, skipSelf: true })) || path;
        } catch (error: any) {
          if (error?.code === "ENOTDIR") {
            throw new Error(
              `Cannot resolve "${path}" — the package may be missing an export condition for this subpath.\n` +
                `Tip: Add an alias in your nitro config:\n` +
                `  alias: { '${path}': '/path/to/correct-file' }`,
              { cause: error }
            );
          }
          throw error;
        }
      },
    },
  };
}
