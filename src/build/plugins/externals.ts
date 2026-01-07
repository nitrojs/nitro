import type { Plugin } from "rollup";
import type { PackageJson } from "pkg-types";
import type { ExternalsTraceOptions } from "nf3";

import { pathToFileURL } from "node:url";
import { builtinModules, createRequire } from "node:module";
import { isAbsolute, join } from "pathe";
import { resolveModulePath } from "exsolve";
import { escapeRegExp, toPathRegExp } from "../../utils/regex.ts";
import consola from "consola";

export type ExternalsOptions = {
  rootDir: string;
  conditions: string[];
  exclude?: (string | RegExp)[];
  include?: (string | RegExp)[];
  trace?:
    | false
    | Omit<
        ExternalsTraceOptions,
        "rootDir" | "exportConditions" | "traceOptions"
      >;
};

const PLUGIN_NAME = "nitro:externals";

export function externals(opts: ExternalsOptions): Plugin {
  const include: RegExp[] | undefined = opts?.include
    ? opts.include.map((p) => toPathRegExp(p))
    : undefined;

  const exclude: RegExp[] = [
    /^(?:[\0#~.]|[a-z0-9]{2,}:)|\?/,
    ...(opts?.exclude || []).map((p) => toPathRegExp(p)),
  ];

  const filter = (id: string) => {
    // Most match at least one include (if specified)
    if (include && !include.some((r) => r.test(id))) {
      return false;
    }
    // Most not match any exclude
    if (exclude.some((r) => r.test(id))) {
      return false;
    }
    return true;
  };

  const tryResolve = (id: string, from: string | undefined) =>
    resolveModulePath(id, {
      try: true,
      from: from && isAbsolute(from) ? from : opts.rootDir,
      conditions: opts.conditions,
    });

  const tracedPaths = new Set<string>();

  if (include && include.length === 0) {
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
            const guessed = await guessSubpath(resolvedPath, opts.conditions);
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
        const { traceNodeModules } = await import("nf3");
        const traceTime = Date.now();
        let traceFilesCount = 0;
        let tracedPkgsCount = 0;
        await traceNodeModules([...tracedPaths], {
          ...opts.trace,
          conditions: opts.conditions,
          rootDir: opts.rootDir,
          writePackageJson: true, // deno compat
          hooks: {
            tracedFiles(result) {
              traceFilesCount = Object.keys(result).length;
            },
            tracedPackages: (pkgs) => {
              tracedPkgsCount = Object.keys(pkgs).length;
              consola.info(
                `Tracing dependencies:\n${Object.entries(pkgs)
                  .map(
                    ([name, versions]) =>
                      `- \`${name}\` (${Object.keys(versions.versions).join(", ")})`
                  )
                  .join("\n")}`
              );
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

// ---- Internal utils ----

const NODE_MODULES_RE =
  /^(?<dir>.+[\\/]node_modules[\\/])(?<name>[^@\\/]+|@[^\\/]+[\\/][^\\/]+)(?:[\\/](?<subpath>.+))?$/;

const IMPORT_RE =
  /^(?!\.)(?<name>[^@/\\]+|@[^/\\]+[/\\][^/\\]+)(?:[/\\](?<subpath>.+))?$/;

function toImport(id: string): string | undefined {
  if (isAbsolute(id)) {
    const { name, subpath } =
      NODE_MODULES_RE.exec(id)?.groups || ({} as Record<string, string>);
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
    const [subpath, condition] = key.startsWith(".")
      ? [key.slice(1)]
      : [undefined, key];
    const _subPath = join(parentSubpath, subpath || "");
    if (typeof value === "string") {
      return [
        { subpath: _subPath, fsPath: value.replace(/^\.\//, ""), condition },
      ];
    }
    return typeof value === "object" ? flattenExports(value, _subPath) : [];
  });
}
