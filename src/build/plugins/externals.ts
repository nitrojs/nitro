import type { Plugin } from "rollup";
import type { PackageJson } from "pkg-types";
import type { ExternalsTraceOptions } from "nf3";

import { pathToFileURL } from "node:url";
import { builtinModules, createRequire } from "node:module";
import { dirname, isAbsolute, join } from "pathe";
import { resolveModulePath } from "exsolve";
import consola from "consola";

import { escapeRegExp, toPathRegExp } from "../../utils/regex.ts";
import { NodeNativePackages, NonBundleablePackages, FullTracePackages } from "nf3/db";

export type ExternalsOptions = {
  rootDir: string;
  conditions: string[];
  exclude: (string | RegExp)[];
  include: (string | RegExp)[];
  trace: false | Omit<ExternalsTraceOptions, "rootDir" | "exportConditions" | "traceOptions">;
};

const PLUGIN_NAME = "nitro:externals";

export function externals(opts: ExternalsOptions): Plugin {
  const resolved = opts.trace ? resolveTraceDeps(opts.include) : undefined;

  const include: RegExp[] | undefined = resolved?.includePattern
    ? [resolved.includePattern]
    : undefined;

  const exclude: RegExp[] = [
    /^(?:[\0#~.]|[a-z0-9]{2,}:)|\?/,
    ...(opts?.exclude || []).map((p) => toPathRegExp(p)),
  ];

  const filter = (id: string) => {
    // Must match at least one include (if specified)
    if (include && !include.some((r) => r.test(id))) {
      return false;
    }
    // Must not match any exclude
    if (exclude.some((r) => r.test(id))) {
      return false;
    }
    return true;
  };

  // exsolve uses only the supplied conditions (no implicit `import`/`default`).
  // Add `import` so packages whose `exports` only declares the `import` condition
  // (e.g. lightningcss) resolve correctly when externalizing for ESM output.
  const resolveConditions = opts.conditions.includes("import")
    ? opts.conditions
    : [...opts.conditions, "import"];

  const tryResolve = (id: string, from: string | undefined) =>
    resolveModulePath(id, {
      try: true,
      from: from && isAbsolute(from) ? from : opts.rootDir,
      conditions: resolveConditions,
    });

  const tracedPaths = new Set<string>();

  // Names to force-trace by name. Seeded with user-declared `traceDeps`; builtin
  // native packages are added here only when observed as (unresolvable) imports
  // during resolution, never wholesale (see `resolveTraceDeps`).
  const forcedTraceIncludes = new Set<string>(resolved?.traceInclude);

  if (opts.trace && !resolved?.includePattern) {
    return {
      name: PLUGIN_NAME,
    };
  }

  return {
    name: PLUGIN_NAME,
    resolveId: {
      order: "pre",
      filter: { id: { exclude, include } },
      async handler(id, importer, rOpts) {
        // Externalize built-in modules with normalized prefix
        if (builtinModules.includes(id)) {
          return {
            resolvedBy: PLUGIN_NAME,
            external: true,
            id: id.includes(":") ? id : `node:${id}`,
          };
        }

        let resolved;

        if (rOpts.custom?.["node-resolve"]) {
          // For nested node-resolve resolutions (e.g., CJS require()),
          // resolve directly to avoid recursion but still externalize
          // modules that match the include filter (e.g., native deps).
          // Only applies when tracing is active (production builds).
          if (!opts.trace) {
            return null;
          }
          const resolvedPath = tryResolve(id, importer);
          if (!resolvedPath || !filter(resolvedPath)) {
            return null;
          }
          resolved = { id: resolvedPath };
        } else {
          // Resolve by other resolvers
          resolved = await this.resolve(id, importer, rOpts);

          // Skip rolldown-plugin-commonjs resolver for externals
          const cjsResolved = resolved?.meta?.commonjs?.resolved;
          if (cjsResolved) {
            if (!filter(cjsResolved.id)) {
              return resolved; // Bundled and wrapped by CJS plugin
            }
            resolved = cjsResolved /* non-wrapped */;
          }
        }

        // Unresolved bare import of a package matching the trace include-pattern.
        // Native/non-bundleable deps (e.g. `sharp`) are often imported from a
        // generated entry outside the declaring package's resolution scope, and
        // under pnpm the nested dep is not resolvable from there. It is force-
        // copied into the output by the trace (`traceInclude`/`traceIncludeRoots`),
        // so externalize it by name instead of letting the bundler fail to resolve.
        if (!resolved?.id) {
          const importId = opts.trace ? toImport(id) : undefined;
          if (importId && include?.some((r) => r.test(importId))) {
            // Observed but unresolvable native import: force-trace it by name.
            // nf3 matches `traceInclude` entries against bare dependency names,
            // so strip any subpath (`pkg/sub` → `pkg`).
            forcedTraceIncludes.add(IMPORT_RE.exec(importId)?.groups?.name ?? importId);
            return {
              resolvedBy: PLUGIN_NAME,
              external: true,
              id: importId,
            };
          }
          return resolved;
        }

        // Check if explicitly marked as excluded
        if (!filter(resolved.id)) {
          return resolved;
        }

        // Normalize to absolute path
        let resolvedPath = resolved.id;
        if (!isAbsolute(resolvedPath)) {
          resolvedPath = tryResolve(resolvedPath, importer) || resolvedPath;
        }

        // Tracing mode
        if (opts.trace) {
          let importId = toImport(id) || toImport(resolvedPath);
          if (!importId) {
            return resolved;
          }
          if (!tryResolve(importId, importer)) {
            const guessed = await guessSubpath(resolvedPath, resolveConditions);
            if (!guessed) {
              return resolved;
            }
            importId = guessed;
          }
          tracedPaths.add(resolvedPath);
          return {
            ...resolved,
            resolvedBy: PLUGIN_NAME,
            external: true,
            id: importId,
          };
        }

        // Resolve as absolute path external
        return {
          ...resolved,
          resolvedBy: PLUGIN_NAME,
          external: true,
          id: isAbsolute(resolvedPath)
            ? pathToFileURL(resolvedPath).href // windows compat
            : resolvedPath,
        };
      },
    },
    buildEnd: {
      order: "post",
      async handler() {
        if (!opts.trace || (tracedPaths.size === 0 && forcedTraceIncludes.size === 0)) {
          return;
        }
        const { hooks: userHooks, ...traceOpts } = opts.trace;
        const { traceNodeModules } = await import("nf3");
        const traceTime = Date.now();
        let traceFilesCount = 0;
        let tracedPkgsCount = 0;
        // Only the names actually observed as imports (plus user `traceDeps`) are
        // force-traced — never the full builtin DB, which would drag build-time
        // tooling into the output.
        const traceInclude = forcedTraceIncludes.size ? [...forcedTraceIncludes] : undefined;
        // Roots from which `traceInclude` names may be resolved when they are not
        // reachable from `rootDir` (pnpm's non-hoisted nested layout): packages
        // bundled into this environment's graph, plus the app's direct deps. A
        // framework dep can be bundled in an upstream build environment (absent
        // from this graph) yet still declare native deps (e.g. `sharp`) that must
        // be traced from its real location.
        const traceIncludeRoots = traceInclude
          ? [
              ...new Set([
                ...(typeof this.getModuleIds === "function"
                  ? (collectPackageRoots(this.getModuleIds()) ?? [])
                  : []),
                ...collectDirectDepRoots(opts.rootDir, opts.conditions),
              ]),
            ]
          : undefined;
        await traceNodeModules([...tracedPaths], {
          ...traceOpts,
          fullTraceInclude: resolved?.fullTraceInclude,
          traceInclude,
          traceIncludeRoots: traceIncludeRoots?.length ? traceIncludeRoots : undefined,
          conditions: opts.conditions,
          rootDir: opts.rootDir,
          writePackageJson: true, // deno compat
          hooks: {
            ...userHooks,
            tracedFiles: async (result) => {
              traceFilesCount = Object.keys(result).length;
              await userHooks?.tracedFiles?.(result);
            },
            tracedPackages: async (pkgs) => {
              tracedPkgsCount = Object.keys(pkgs).length;
              consola.info(
                `Tracing dependencies:\n${Object.entries(pkgs)
                  .map(
                    ([name, versions]) =>
                      `- \`${name}\` (${Object.keys(versions.versions).join(", ")})`
                  )
                  .join("\n")}`
              );
              await userHooks?.tracedPackages?.(pkgs);
            },
          },
        });
        consola.success(
          `Traced ${tracedPkgsCount} dependencies (${traceFilesCount} files) in ${Date.now() - traceTime}ms.`
        );
        consola.info(
          `Ensure your production environment matches the builder OS and architecture (\`${process.platform}-${process.arch}\`) to avoid native module issues.`
        );
      },
    },
  };
}

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
  // User-declared named deps to always force-trace by name. Builtin native
  // packages are intentionally NOT force-traced wholesale: many of them are
  // build-time-only tooling (e.g. `rolldown`/`rollup`/`vite`, declared as deps
  // by `nitro` itself) that must never be copied into the runtime output. A
  // builtin is force-traced only when it is actually observed as an
  // (unresolvable) import during the build — nft cannot statically detect
  // dynamically-loaded native bindings, so those observed names are collected at
  // resolve time and traced explicitly. Force-tracing by name also fixes pnpm,
  // where a nested dependency only resolves from the dependent package's real
  // `.pnpm` location.
  const traceInclude = userTraceDeps.filter(
    (d): d is string => typeof d === "string" && !negated.has(d)
  );
  return {
    includePattern: tracePattern
      ? new RegExp(`(?:^|[/\\\\]node_modules[/\\\\])(?:${tracePattern})(?:[/\\\\]|$)`)
      : undefined,
    fullTraceInclude: fullTraceInclude.length > 0 ? fullTraceInclude : undefined,
    traceInclude: traceInclude.length > 0 ? traceInclude : undefined,
  };
}

// ---- Internal utils ----

const NODE_MODULES_RE =
  /^(?<dir>.+[\\/]node_modules[\\/])(?<name>[^@\\/]+|@[^\\/]+[\\/][^\\/]+)(?:[\\/](?<subpath>.+))?$/;

const IMPORT_RE = /^(?!\.)(?<name>[^@/\\]+|@[^/\\]+[/\\][^/\\]+)(?:[/\\](?<subpath>.+))?$/;

export function collectPackageRoots(moduleIds: Iterable<string>): string[] | undefined {
  const roots = new Set<string>();
  for (const id of moduleIds) {
    const { dir, name } = NODE_MODULES_RE.exec(id)?.groups || {};
    if (dir && name) {
      roots.add(join(dir, name));
    }
  }
  return roots.size > 0 ? [...roots] : undefined;
}

// Resolved package roots of the app's direct dependencies. Used as declarer
// candidates for `traceInclude`: a direct dep may be bundled (so it never
// appears as a traced package) yet declare native deps that only resolve from
// its own real, non-hoisted pnpm location.
export function collectDirectDepRoots(rootDir: string, conditions: string[]): string[] {
  const pkg = getPkgJSON(join(rootDir, "/"));
  if (!pkg) {
    return [];
  }
  const roots = new Set<string>();
  for (const name of Object.keys({
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.optionalDependencies,
  })) {
    const resolved = resolveModulePath(`${name}/package.json`, {
      try: true,
      from: rootDir,
      conditions,
    });
    if (resolved) {
      roots.add(dirname(resolved));
    }
  }
  return [...roots];
}

function toImport(id: string): string | undefined {
  if (isAbsolute(id)) {
    const { name, subpath } = NODE_MODULES_RE.exec(id)?.groups || ({} as Record<string, string>);
    if (name && subpath) {
      return join(name, subpath);
    }
  } else if (IMPORT_RE.test(id)) {
    return id;
  }
}

function guessSubpath(path: string, conditions: string[]): string | undefined {
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
