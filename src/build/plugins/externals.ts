import type { Plugin } from "rollup";
import { pathToFileURL } from "node:url";

export type ExternalsOptions = {
  include?: FilterMatcher[];
  exclude?: FilterMatcher[];
};

export function externals(opts: ExternalsOptions): Plugin {
  const filter = createFilter(opts);
  return {
    name: "nitro:externals",
    resolveId: {
      order: "pre",
      filter: { id: { exclude: /^(?:[\0#~.]|[a-z0-9]{2,}:)|\?/ } },
      async handler(id, importer, rOpts) {
        if (!filter(id)) {
          return null;
        }
        const resolved = await this.resolve(id, importer, rOpts);
        if (!resolved) {
          return null;
        }
        return {
          id: pathToFileURL(resolved.id).href,
          external: true,
        };
      },
    },
  };
}

// --- helper functions for filter matching ---

type FilterFunction = (id: string) => boolean;
type FilterMatcher = string | RegExp | FilterFunction;

function createFilter(opts: {
  include?: FilterMatcher[];
  exclude?: FilterMatcher[];
}) {
  const includeMatchers = (opts?.include || [])
    .map((m) => toMatcher(m))
    .filter(Boolean) as FilterFunction[];
  const excludeMatchers = (opts?.exclude || [])
    .map((m) => toMatcher(m))
    .filter(Boolean) as FilterFunction[];

  // Should match one of the includes and none of the excludes
  return (id: string) => {
    if (includeMatchers.length > 0 && !includeMatchers.some((fn) => fn(id))) {
      return false;
    }
    if (excludeMatchers.some((fn) => fn(id))) {
      return false;
    }
    return true;
  };
}

function toMatcher(
  filter: string | RegExp | ((id: string) => boolean)
): FilterFunction | undefined {
  if (typeof filter === "string") {
    return (id: string) => id.startsWith(filter);
  } else if (filter instanceof RegExp) {
    return (id: string) => filter.test(id);
  } else if (typeof filter === "function") {
    return filter;
  }
}
