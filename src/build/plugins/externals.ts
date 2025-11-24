import type { Plugin } from "rollup";
import { pathToFileURL } from "node:url";
import { isAbsolute } from "pathe";
import { escapeRegExp } from "../../utils/regex.ts";

export type ExternalsOptions = {
  noExternal?: (string | RegExp)[];
};

export function externals(opts: ExternalsOptions): Plugin {
  const noExternal: RegExp[] = [
    /^(?:[\0#~.]|[a-z0-9]{2,}:)|\?/,
    ...(opts?.noExternal || []).map((i) => toRegexFilter(i)),
  ];

  return {
    name: "nitro:externals",
    resolveId: {
      order: "pre",
      filter: { id: { exclude: noExternal } },
      async handler(id, importer, rOpts) {
        const resolved = await this.resolve(id, importer, rOpts);
        if (!resolved?.id || noExternal.some((p) => p.test(resolved.id))) {
          return resolved;
        }
        return {
          external: true,
          id: isAbsolute(resolved.id)
            ? pathToFileURL(resolved.id).href
            : resolved.id,
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
