import type { Nitro } from "nitro/types";
import type { Plugin } from "rollup";
import { resolveModulePath } from "exsolve";
import { ensureDep } from "../../utils/dep.ts";
import { pathRegExp } from "../../utils/regex.ts";

const UNENV_VERSION = "^2.0.0-rc.24";

/** Whether a module id refers to an `unenv` polyfill. */
export function isUnenvId(id: string): boolean {
  return id.startsWith("unenv/");
}

/**
 * Resolves `unenv` polyfills (and the modules aliased to them) on demand.
 *
 * `unenv` is not a dependency of Nitro: it is resolved from the project and
 * only installed once a build actually bundles one of its polyfills.
 */
export function unenv(nitro: Nitro, alias: Record<string, string>): Plugin {
  const aliases = Object.fromEntries(Object.entries(alias).filter(([, to]) => isUnenvId(to)));
  let installed: Promise<boolean> | undefined;

  return {
    name: "nitro:unenv",
    resolveId: {
      order: "pre",
      filter: {
        id: new RegExp(
          `^(unenv/|(${Object.keys(aliases)
            .map((id) => pathRegExp(id))
            .join("|")})$)`
        ),
      },
      async handler(id) {
        const target = aliases[id] || id;
        if (!isUnenvId(target)) {
          return;
        }
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
        return resolveModulePath(target, { from: [nitro.options.rootDir, import.meta.url] });
      },
    },
  };
}
