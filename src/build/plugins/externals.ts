import type { Plugin } from "rollup";
import { pathToFileURL } from "node:url";
import { isAbsolute } from "pathe";

export type ExternalsOptions = {
  include?: FilterMatcher[];
  exclude?: FilterMatcher[];
};

const NO_EXTERNAL_RE = /^(?:[\0#~.]|[a-z0-9]{2,}:)|\?/;

export function externals(opts: ExternalsOptions): Plugin {
  const exclude = createFilter(opts?.exclude || []);
  return {
    name: "nitro:externals",
    resolveId: {
      order: "pre",
      filter: { id: { exclude: NO_EXTERNAL_RE } },
      async handler(id, importer, rOpts) {
        if (exclude(id)) {
          return null;
        }
        const resolved = await this.resolve(id, importer, rOpts);
        if (
          !resolved?.id ||
          NO_EXTERNAL_RE.test(resolved.id) ||
          !filter(resolved.id)
        ) {
          return resolved;
        }
        if (id.includes("test")) {
          console.log(">", id);
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

// --- helper functions for filter matching ---

type FilterFunction = (id: string) => boolean;
type FilterMatcher = string | RegExp | FilterFunction;

function createFilter(matchers: FilterMatcher[] = []) {
  const matcherFns = matchers
    .map((m) => toMatcher(m))
    .filter((m): m is FilterFunction => typeof m === "function");
  return (id: string) => matcherFns.some((fn) => fn(id));
}

function toMatcher(
  filter: string | RegExp | ((id: string) => boolean)
): FilterFunction | undefined {
  if (typeof filter === "string") {
    return Object.assign((id: string) => id.startsWith(filter), { filter });
  } else if (filter instanceof RegExp) {
    return Object.assign((id: string) => filter.test(id), { filter });
  } else if (typeof filter === "function") {
    return filter;
  }
}
