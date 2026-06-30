import type { Plugin } from "rollup";
import type { ExternalsTraceOptions } from "nf3";

import { pathToFileURL } from "node:url";
import { builtinModules } from "node:module";
import { isAbsolute } from "pathe";
import { resolveModulePath } from "exsolve";
import consola from "consola";

import { toPathRegExp } from "../../utils/regex.ts";
import { guessSubpath, resolveTraceDeps, toImport } from "../_externals-utils.ts";

export { resolveTraceDeps };

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

