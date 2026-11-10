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
 * (checked before plugins). The `require()` of the `node:` modules the runtime provides
 * (`env.external`) is turned into an ESM import, the same way as Rolldown's
 * `esmExternalRequirePlugin`. Other ones are kept, so that a guarded `require()` of a module the
 * runtime lacks still fails only when called.
 */
export function builtinExternals(
  env: Pick<BuildEnv, "alias" | "external">,
  opts: { node: boolean }
): RolldownPlugin | false {
  const externals = new Map(
    Object.entries(env.alias).filter(([id, to]) => to !== id && to.startsWith("node:"))
  );
  const native = new Set<string>();
  if (!opts.node) {
    for (const id of builtins) {
      if (!env.alias[id] || env.alias[id] === id) {
        externals.set(id, id);
      }
    }
    for (const id of env.external) {
      externals.set(id, id);
      if (id.startsWith("node:")) {
        native.add(id);
      }
    }
  }
  if (externals.size === 0) {
    return false;
  }
  return {
    name: "nitro:builtins",
    // A user `external` would externalize them before `resolveId`
    options(options) {
      if (native.size > 0 && Array.isArray(options.external)) {
        options.external = options.external.filter(
          (id) => typeof id !== "string" || !native.has(externals.get(id)!)
        );
      }
    },
    resolveId: {
      order: "pre",
      filter: {
        id: new RegExp(`^(${[...externals.keys()].map((id) => escapeRegExp(id)).join("|")})$`),
      },
      handler(id, _importer, options) {
        const target = externals.get(id)!;
        if (options.kind === "require-call" && native.has(target)) {
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
          `module.exports = m.default;`,
        ].join("\n"),
    },
  };
}
