import type { RolldownPlugin } from "rolldown";
import { builtinModules } from "node:module";
import type { BuildEnv } from "../env.ts";
import { escapeRegExp } from "../../utils/regex.ts";

// Some builtins are only listed with a prefix (e.g. `node:sqlite`, or `bun:sqlite` with Bun)
export const builtins: string[] = builtinModules.flatMap((m) =>
  m.includes(":") ? [m] : [m, `node:${m}`]
);

const REQUIRE_PREFIX = "\0nitro-require-builtin:";

/**
 * Externalizes ids aliased to another `node:` id (e.g. `events` or `buffer/` to `node:events` or
 * `node:buffer`) with that id (Rolldown only resolves aliases to `node:` ids with the `node` platform).
 *
 * Without the `node` platform, Rolldown keeps a `require()` of an external builtin from CommonJS
 * as a runtime call (Deno has no global `require`, and workerd returns the module namespace). All
 * builtins and `env.external` ids are externalized here instead of with the `external` option
 * (checked before plugins), and their `require()` is turned into an ESM import, the same way as
 * Rolldown's `esmExternalRequirePlugin`.
 */
export function builtinExternals(
  env: Pick<BuildEnv, "alias" | "external">,
  opts: { node: boolean }
): RolldownPlugin | false {
  const externals = new Map(
    Object.entries(env.alias).filter(([id, to]) => to !== id && to.startsWith("node:"))
  );
  if (!opts.node) {
    for (const id of builtins) {
      if (!env.alias[id] || env.alias[id] === id) {
        externals.set(id, id);
      }
    }
    for (const id of env.external) {
      externals.set(id, id);
    }
  }
  if (externals.size === 0) {
    return false;
  }
  return {
    name: "nitro:builtins",
    resolveId: {
      order: "pre",
      filter: {
        id: new RegExp(`^(${[...externals.keys()].map((id) => escapeRegExp(id)).join("|")})$`),
      },
      handler(id, _importer, options) {
        const target = externals.get(id)!;
        if (!opts.node && options.kind === "require-call") {
          return REQUIRE_PREFIX + target;
        }
        return { id: target, external: true };
      },
    },
    load: {
      filter: { id: new RegExp(`^${escapeRegExp(REQUIRE_PREFIX)}`) },
      handler: (id) =>
        [
          `import * as m from ${JSON.stringify(id.slice(REQUIRE_PREFIX.length))};`,
          `module.exports = "default" in m ? m.default : m;`,
        ].join("\n"),
    },
  };
}
