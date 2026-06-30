import type { PackageJson } from "pkg-types";

import { createRequire } from "node:module";
import { isAbsolute, join } from "pathe";

import { escapeRegExp } from "../utils/regex.ts";
import { NodeNativePackages, NonBundleablePackages, FullTracePackages } from "nf3/db";

const NODE_MODULES_RE =
  /^(?<dir>.+[\\/]node_modules[\\/])(?<name>[^@\\/]+|@[^\\/]+[\\/][^\\/]+)(?:[\\/](?<subpath>.+))?$/;

const IMPORT_RE = /^(?!\.)(?<name>[^@/\\]+|@[^/\\]+[/\\][^/\\]+)(?:[/\\](?<subpath>.+))?$/;

/**
 * Map a resolved filesystem path back to a bare specifier (`pkgname[/subpath]`).
 * Used by both rolldown and rspack externals plugins so traced externals appear
 * as natural Node imports rather than verbatim pnpm-store paths.
 */
export function toImport(id: string): string | undefined {
  if (isAbsolute(id)) {
    const { name, subpath } = NODE_MODULES_RE.exec(id)?.groups || ({} as Record<string, string>);
    if (name && subpath) {
      return join(name, subpath);
    }
  } else if (IMPORT_RE.test(id)) {
    return id;
  }
}

/**
 * For packages without an exports map (or when `toImport()` can't reverse the absolute
 * path back to an import specifier), walk the package's `exports` and try to match the
 * resolved subpath. Returns `<name>/<subpath>` on success.
 */
export function guessSubpath(path: string, conditions: string[]): string | undefined {
  const { dir, name, subpath } = NODE_MODULES_RE.exec(path)?.groups || {};
  if (!dir || !name || !subpath) {
    return;
  }
  const pkgDir = join(dir, name) + "/";
  const exports = getPkgJSON(pkgDir)?.exports;
  if (!exports || typeof exports !== "object") {
    return;
  }
  for (const e of flattenExports(exports)) {
    if (!conditions.includes(e.condition || "default")) {
      continue;
    }
    if (e.fsPath === subpath) {
      return join(name, e.subpath);
    }
    if (e.fsPath.includes("*")) {
      const fsPathRe = new RegExp(
        "^" + escapeRegExp(e.fsPath).replace(String.raw`\*`, "(.+?)") + "$"
      );
      if (fsPathRe.test(subpath)) {
        const matched = fsPathRe.exec(subpath)?.[1];
        if (matched) {
          return join(name, e.subpath.replace("*", matched));
        }
      }
    }
  }
}

/**
 * Normalize `nitro.options.traceDeps` into an `includePattern` (regex that matches paths
 * inside `node_modules/<name>/...`) and an optional `fullTraceInclude` list passed straight
 * to nf3. Honors negation (`!pkgname`) and full-trace markers (`pkgname*`).
 */
export function resolveTraceDeps(
  traceDeps: (string | RegExp)[],
  opts: {
    builtinPackages?: readonly string[];
    builtinFullTrace?: readonly string[];
  } = {}
) {
  const builtinPackages = opts.builtinPackages ?? [...NodeNativePackages, ...NonBundleablePackages];
  const builtinFullTrace = opts.builtinFullTrace ?? FullTracePackages;
  const negated = new Set<string>();
  const userTraceDeps: (string | RegExp)[] = [];
  const userFullTrace: string[] = [];
  for (const d of traceDeps) {
    if (typeof d !== "string") {
      userTraceDeps.push(d);
    } else if (d === "!" || d === "*" || d === "") {
      throw new Error(`Invalid traceDeps selector: "${d}"`);
    } else if (d.startsWith("!")) {
      negated.add(d.slice(1));
    } else if (d.endsWith("*")) {
      const name = d.slice(0, -1);
      userFullTrace.push(name);
      userTraceDeps.push(name);
    } else {
      userTraceDeps.push(d);
    }
  }
  const resolved = [...new Set([...builtinPackages, ...userTraceDeps])].filter(
    (d) => typeof d !== "string" || !negated.has(d)
  );
  const tracePattern = resolved
    .map((d) => (d instanceof RegExp ? d.source : escapeRegExp(d)))
    .join("|");
  const fullTraceInclude = [...new Set([...builtinFullTrace, ...userFullTrace])].filter(
    (d) => !negated.has(d)
  );
  return {
    includePattern: tracePattern
      ? new RegExp(`(?:^|[/\\\\]node_modules[/\\\\])(?:${tracePattern})(?:[/\\\\]|$)`)
      : undefined,
    fullTraceInclude: fullTraceInclude.length > 0 ? fullTraceInclude : undefined,
  };
}

function getPkgJSON(dir: string): PackageJson | undefined {
  const cache = ((getPkgJSON as any)._cache ||= new Map<string, PackageJson>());
  if (cache.has(dir)) {
    return cache.get(dir);
  }
  try {
    const pkg = createRequire(dir)("./package.json");
    cache.set(dir, pkg);
    return pkg;
  } catch {
    /* ignore */
  }
}

// Based on mlly
function flattenExports(
  exports: Exclude<PackageJson["exports"], string> = {},
  parentSubpath = "./"
): { subpath: string; fsPath: string; condition?: string }[] {
  return Object.entries(exports).flatMap(([key, value]) => {
    const [subpath, condition] = key.startsWith(".") ? [key.slice(1)] : [undefined, key];
    const _subPath = join(parentSubpath, subpath || "");
    if (typeof value === "string") {
      return [{ subpath: _subPath, fsPath: value.replace(/^\.\//, ""), condition }];
    }
    return typeof value === "object" ? flattenExports(value, _subPath) : [];
  });
}
