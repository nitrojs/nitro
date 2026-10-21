import type { Nitro } from "nitro/types";
import type { Plugin } from "rollup";
import { existsSync, statSync } from "node:fs";
import { createPathsMatcher } from "get-tsconfig";
import { join } from "pathe";
import { chain } from "../../utils/sync.ts";

/**
 * Resolves `compilerOptions.paths` of the project `tsconfig.json` (`typescript.tsConfig`)
 * for project sources. The `alias` option (and Vite `resolve.alias`) takes precedence.
 *
 * Relative targets of a `typescript.tsConfig` object resolve from `rootDir` (or `baseUrl`),
 * those of a loaded `tsconfig.json` from the config declaring them (`extends`).
 */
export function tsconfigPaths(nitro: Nitro, aliases: Record<string, string>): Plugin | undefined {
  const paths = loadPaths(nitro);
  if (!paths) {
    return;
  }
  const { keys, candidates } = paths;
  // Skipped ids and `alias` keys are excluded by the filter (native with rolldown)
  const excludes = [
    SKIP_ID,
    ...Object.keys(aliases).map((key) => `${escapeRE(key.replace(/\/$/, ""))}(?:/|$)`),
  ];
  const idRE = new RegExp(`^(?!${excludes.join("|")})(?:${keys.map(patternRegExp).join("|")})$`);
  return {
    name: "nitro:tsconfig-paths",
    resolveId: {
      // Before the builtin resolvers (Vite), like the `paths` of TypeScript
      order: "pre",
      filter: { id: idRE },
      handler(id, importer, options) {
        // `idRE` again for rollup versions without hook filters
        if (
          !importer ||
          !idRE.test(id) ||
          NODE_MODULES_RE.test(importer) ||
          isViteAlias(this, id)
        ) {
          return;
        }
        const targets = candidates(id);
        const next = (index: number): ReturnType<typeof this.resolve> | undefined =>
          index < targets.length
            ? (chain(
                this.resolve(targets[index]!, importer, { ...options, skipSelf: true }),
                (resolved) => resolved ?? next(index + 1)
              ) as ReturnType<typeof this.resolve>)
            : undefined;
        return next(0);
      },
    },
  };
}

/**
 * `paths` patterns that can match package imports, which Vite dev externalizes without
 * calling plugins. Exact keys are only included with an existing target (otherwise the
 * package would be inlined), patterns without a prefix (`*`) would include all dependencies.
 */
export function tsconfigPathsNoExternal(nitro: Nitro): RegExp[] {
  const paths = loadPaths(nitro);
  const keys = (paths?.keys || []).filter((key) =>
    key.includes("*") ? !key.startsWith("*") : paths!.candidates(key).some(isFile)
  );
  return keys.length > 0 ? [pathsRegExp(keys)] : [];
}

interface TsconfigPaths {
  keys: string[];
  /** Targets of an import, without type-only ones (e.g. framework generated). */
  candidates: (id: string) => string[];
}

const pathsCache = new WeakMap<Nitro, TsconfigPaths | undefined>();

function loadPaths(nitro: Nitro): TsconfigPaths | undefined {
  if (!pathsCache.has(nitro)) {
    pathsCache.set(nitro, _loadPaths(nitro));
  }
  return pathsCache.get(nitro);
}

function _loadPaths(nitro: Nitro): TsconfigPaths | undefined {
  const tsConfig = nitro.options.typescript.tsConfig;
  const keys = Object.keys(tsConfig?.compilerOptions?.paths || {});
  if (nitro.options.typescript.tsconfigPaths === false || keys.length === 0) {
    return;
  }
  let matcher: ReturnType<typeof createPathsMatcher>;
  try {
    matcher = createPathsMatcher({
      path: join(nitro.options.rootDir, "tsconfig.json"),
      config: tsConfig as Parameters<typeof createPathsMatcher>[0]["config"],
    });
  } catch (error) {
    nitro.logger.warn(
      `Ignoring \`compilerOptions.paths\` of the project tsconfig: ${(error as Error).message}`
    );
    return;
  }
  if (!matcher) {
    return;
  }
  return {
    keys,
    candidates: (id) => matcher(id).filter((path) => !TYPES_RE.test(path)),
  };
}

/** Vite `resolve.alias` (in the Vite environments), applied after `pre` hooks. */
function isViteAlias(ctx: unknown, id: string): boolean {
  const alias = (ctx as { environment?: { config?: { resolve?: { alias?: unknown } } } })
    .environment?.config?.resolve?.alias;
  if (!Array.isArray(alias) || alias.length === 0) {
    return false;
  }
  let matcher = viteAliasCache.get(alias);
  if (!matcher) {
    const res = alias.map(({ find }: { find: string | RegExp }) =>
      typeof find === "string" ? new RegExp(`^${escapeRE(find)}(?:\\/|$)`) : find
    );
    matcher = (id) => res.some((re) => re.test(id));
    viteAliasCache.set(alias, matcher);
  }
  return matcher(id);
}

const viteAliasCache = new WeakMap<object, (id: string) => boolean>();

function isFile(path: string): boolean {
  return [
    path,
    ...SCRIPT_EXTENSIONS.map((ext) => path + ext),
    ...SCRIPT_EXTENSIONS.map((ext) => join(path, `index${ext}`)),
  ].some((file) => existsSync(file) && statSync(file).isFile());
}

const SCRIPT_EXTENSIONS = [".ts", ".mts", ".cts", ".tsx", ".js", ".mjs", ".cjs", ".jsx"];

const NODE_MODULES_RE = /[\\/]node_modules[\\/]/;

// Declaration files and `@types` packages
const TYPES_RE = /\.d\.(?:[^/\\]+\.)?[cm]?ts$|[\\/]node_modules[\\/]@types[\\/]/;

// Absolute paths, virtual modules and URL schemes (`node:`, `virtual:`), e.g. for a `*` key.
// Keys containing `:` (like `app:*`) are not supported.
const SKIP_ID = String.raw`[/\\\0]|#nitro\/|[a-zA-Z][\w+.-]*:`;

function pathsRegExp(keys: string[]): RegExp {
  return new RegExp(`^(?:${keys.map(patternRegExp).join("|")})$`);
}

function patternRegExp(pattern: string): string {
  return pattern.split("*").map(escapeRE).join(".*");
}

function escapeRE(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
