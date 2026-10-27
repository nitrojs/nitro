import { statSync } from "node:fs";
import { isAbsolute } from "node:path";
import escapeStringRegexp from "escape-string-regexp";

export function resolveAliases(_aliases: Record<string, string>) {
  // Sort aliases from specific to general (ie. fs/promises before fs)
  const aliases = Object.fromEntries(
    Object.entries(_aliases).sort(
      ([a], [b]) =>
        b.split("/").length - a.split("/").length || b.length - a.length
    )
  );
  // Resolve alias values in relation to each other
  for (const key in aliases) {
    for (const alias in aliases) {
      if (!["~", "@", "#"].includes(alias[0])) {
        continue;
      }
      if (alias === "@" && !aliases[key].startsWith("@/")) {
        continue;
      } // Don't resolve @foo/bar

      if (aliases[key].startsWith(alias)) {
        aliases[key] = aliases[alias] + aliases[key].slice(alias.length);
      }
    }
  }
  return Object.entries(aliases).map(([find, replacement]) => ({
    // A resolved package entry is a file, not a directory containing subpaths.
    // Let unmatched subpaths resolve through their own package exports.
    find:
      isAbsolute(replacement) &&
      statSync(replacement, { throwIfNoEntry: false })?.isFile()
        ? new RegExp(`^${escapeStringRegexp(find)}$`)
        : find,
    replacement,
  }));
}
