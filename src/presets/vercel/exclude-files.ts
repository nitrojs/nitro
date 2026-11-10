import fsp from "node:fs/promises";
import picomatch from "picomatch";
import { isAbsolute, join } from "pathe";

export type FileExcluder = ReturnType<typeof createFileExcluder>;

type RemoveOptions = {
  isMatch: (path: string) => boolean;
  isIgnored: (path: string) => boolean;
  parentMatched?: boolean;
};

/**
 * Removes the files matching `excludeFiles` globs from function directories, and remembers
 * which patterns matched nothing in any of them.
 */
export function createFileExcluder() {
  const matchedPatterns = new Map<string, boolean>();
  return {
    async exclude(
      funcDir: string,
      excludeFiles: string | string[] | undefined,
      opts: { handler?: string } = {}
    ) {
      const patterns = normalizePatterns(excludeFiles);
      const include = patterns.filter((pattern) => !isNegated(pattern));
      if (include.length === 0) {
        return;
      }
      const matchers = include.map((pattern) => {
        if (!matchedPatterns.has(pattern)) {
          matchedPatterns.set(pattern, false);
        }
        return { pattern, isMatch: picomatch(pattern, { dot: true }) };
      });
      const isIgnored = picomatch(
        [
          ".vc-config.json",
          ...patterns.filter((pattern) => isNegated(pattern)).map((p) => p.slice(1)),
        ],
        { dot: true }
      );
      const handler = opts.handler?.replace(/^\.\//, "");
      if (handler && !isIgnored(handler)) {
        const hit = matchers.find(({ isMatch }) => matchesPathOrParent(isMatch, handler));
        if (hit) {
          throw new Error(
            `[vercel] \`excludeFiles\` pattern \`${hit.pattern}\` matches the function handler \`${handler}\`. Use a narrower pattern: the function cannot run without its handler.`
          );
        }
      }
      await removeMatches(funcDir, "", {
        isIgnored,
        isMatch: (path) => {
          let matched = false;
          for (const { pattern, isMatch } of matchers) {
            if (isMatch(path)) {
              matchedPatterns.set(pattern, true);
              matched = true;
            }
          }
          return matched;
        },
      });
    },
    unmatchedPatterns() {
      return [...matchedPatterns].filter(([, matched]) => !matched).map(([pattern]) => pattern);
    },
  };
}

function normalizePatterns(excludeFiles: string | string[] | undefined): string[] {
  if (excludeFiles === undefined) {
    return [];
  }
  const patterns = Array.isArray(excludeFiles) ? excludeFiles : [excludeFiles];
  return patterns.map((pattern) => {
    if (typeof pattern !== "string") {
      throw new TypeError(
        `[vercel] Invalid \`excludeFiles\` pattern \`${JSON.stringify(pattern)}\`. Use a glob string or an array of glob strings.`
      );
    }
    const negated = isNegated(pattern);
    const glob = (negated ? pattern.slice(1) : pattern).replace(/^\.\//, "");
    if (!glob) {
      throw new Error(
        `[vercel] Invalid empty \`excludeFiles\` pattern. Use \`[]\` to exclude no files.`
      );
    }
    if (isAbsolute(glob) || glob.split("/").includes("..")) {
      throw new Error(
        `[vercel] Invalid \`excludeFiles\` pattern \`${pattern}\`. Patterns are relative to the function directory and cannot leave it.`
      );
    }
    return negated ? `!${glob}` : glob;
  });
}

/**
 * Removes the matching entries of `dir`, without following symlinks. A directory or symlink
 * matches when its path, or its path as a directory (`dir/**`), matches, and everything in a
 * matching directory matches. Ignored entries are kept. Directories emptied by the removal are
 * removed too. Returns whether `dir` should be removed.
 */
async function removeMatches(root: string, dir: string, opts: RemoveOptions): Promise<boolean> {
  const entries = await fsp.readdir(join(root, dir), { withFileTypes: true });
  let removed = 0;
  for (const entry of entries) {
    const path = dir ? `${dir}/${entry.name}` : entry.name;
    const isDirLike = entry.isDirectory() || entry.isSymbolicLink();
    // Match every entry, also under a matched directory, to track which patterns match
    const selfMatched = opts.isMatch(path);
    const dirMatched = isDirLike && opts.isMatch(`${path}/`);
    if (opts.isIgnored(path)) {
      continue;
    }
    const matched = opts.parentMatched || selfMatched || dirMatched;
    if (entry.isDirectory()) {
      if (await removeMatches(root, path, { ...opts, parentMatched: matched })) {
        await fsp.rmdir(join(root, path));
        removed++;
      }
    } else if (matched) {
      await fsp.rm(join(root, path));
      removed++;
    }
  }
  return removed === entries.length && (removed > 0 || !!opts.parentMatched);
}

/** Whether `isMatch` matches `path`, or one of its parent directories (as `dir` or `dir/`). */
function matchesPathOrParent(isMatch: (path: string) => boolean, path: string): boolean {
  const segments = path.split("/");
  return segments.some((_, index) => {
    const prefix = segments.slice(0, index + 1).join("/");
    return isMatch(prefix) || (index < segments.length - 1 && isMatch(`${prefix}/`));
  });
}

/** A leading `!` negates a pattern, unless it starts an extglob (`!(...)`), as in picomatch. */
function isNegated(pattern: string): boolean {
  return pattern.startsWith("!") && pattern[1] !== "(";
}
