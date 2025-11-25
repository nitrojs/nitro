import type { Plugin } from "rollup";
import { pathToFileURL } from "node:url";
import { isAbsolute } from "pathe";
import { resolveModulePath } from "exsolve";
import { builtinModules } from "node:module";
import { escapeRegExp } from "../../utils/regex.ts";

export type ExternalsOptions = {
  rootDir: string;
  noExternal?: (string | RegExp)[];
};

const PLUGIN_NAME = "nitro:externals";

export function externals(opts: ExternalsOptions): Plugin {
  const noExternal: RegExp[] = [
    /^(?:[\0#~.]|[a-z0-9]{2,}:)|\?/,
    ...(opts?.noExternal || []).map((i) => toRegexFilter(i)),
  ];

  return {
    name: PLUGIN_NAME,
    resolveId: {
      order: "pre",
      filter: { id: { exclude: noExternal } },
      async handler(id, importer, rOpts) {
        // Externalize built-in modules with normalized prefix
        if (builtinModules.includes(id)) {
          return {
            resolvedBy: PLUGIN_NAME,
            external: true,
            id: id.includes(":") ? id : `node:${id}`,
          };
        }

        // Resolve
        let resolved = await this.resolve(id, importer, rOpts);

        // Keep CommonJS external imports as ESM externals (rollup quirk) unless explicitly marked as no external to bundle
        const cjsResolved = resolved?.meta?.commonjs
          ?.resolved as typeof resolved;
        if (cjsResolved) {
          if (noExternal.some((p) => p.test(cjsResolved.id))) {
            // return null;
            return resolved;
          }
          resolved = cjsResolved as typeof resolved;
        }

        // Check if not resolved or explicitly marked as no external
        if (!resolved?.id || noExternal.some((p) => p.test(resolved!.id))) {
          return resolved;
        }

        // Resolve to absolute path (rollup quirk)
        let externalId = resolved.id;
        if (!isAbsolute(externalId)) {
          externalId =
            resolveModulePath(externalId, {
              try: true,
              from: importer || opts.rootDir,
            }) || externalId;
        }

        // Convert to file URL if absolute path for windows compatibility
        if (isAbsolute(externalId)) {
          externalId = pathToFileURL(externalId).href;
        }

        // Mark as external
        return {
          ...resolved,
          resolvedBy: PLUGIN_NAME,
          external: true,
          id: externalId,
        };
      },
    },
  };
}

function toRegexFilter(input: string | RegExp): RegExp {
  if (input instanceof RegExp) {
    return input;
  }
  if (typeof input === "string") {
    return new RegExp("^" + escapeRegExp(input));
  }
  throw new TypeError("Expected a string or RegExp", { cause: input });
}
