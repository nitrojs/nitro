import type { Plugin } from "rollup";
import type { PackageJson } from "pkg-types";
import type { ExternalsTraceOptions } from "nf3";

import { pathToFileURL } from "node:url";
import { builtinModules, createRequire } from "node:module";
import { isAbsolute, join } from "pathe";
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

        // Skip nested rollup-node resolutions
        if (rOpts.custom?.["node-resolve"]) {
          return null;
        }

        // Resolve by other resolvers
        let resolved = await this.resolve(id, importer, rOpts);

        // Skip rolldown-plugin-commonjs resolver for externals
        const cjsResolved = resolved?.meta?.commonjs?.resolved;
        if (cjsResolved) {
          if (!filter(cjsResolved.id)) {
            return resolved; // Bundled and wrapped by CJS plugin
          }
          resolved = cjsResolved /* non-wrapped */;
        }

        // Check if not resolved or explicitly marked as excluded
        if (!resolved?.id || !filter(resolved!.id)) {
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
        if (!opts.trace || tracedPaths.size === 0) {
          return;
        }
        const { hooks: userHooks, ...traceOpts } = opts.trace;
        const { traceNodeModules } = await import("nf3");
        const traceTime = Date.now();
        let traceFilesCount = 0;
        let tracedPkgsCount = 0;
        await traceNodeModules([...tracedPaths], {
          ...traceOpts,
          fullTraceInclude: resolved?.fullTraceInclude,
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
  return {
    includePattern: tracePattern
      ? new RegExp(`(?:^|[/\\\\]node_modules[/\\\\])(?:${tracePattern})(?:[/\\\\]|$)`)
      : undefined,
    fullTraceInclude: fullTraceInclude.length > 0 ? fullTraceInclude : undefined,
  };
}

// ---- Internal utils ----

const NODE_MODULES_RE =
  /^(?<dir>.+[\\/]node_modules[\\/])(?<name>[^@\\/]+|@[^\\/]+[\\/][^\\/]+)(?:[\\/](?<subpath>.+))?$/;

const IMPORT_RE = /^(?!\.)(?<name>[^@/\\]+|@[^/\\]+[/\\][^/\\]+)(?:[/\\](?<subpath>.+))?$/;

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
