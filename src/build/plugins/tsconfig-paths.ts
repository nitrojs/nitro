import type { Nitro } from "nitro/types";
import type { Plugin } from "rollup";
import { createPathsMatcher } from "get-tsconfig";
import { join } from "pathe";
import { normalizeAliases, resolveAlias } from "pathe/utils";
import { chain } from "../../utils/sync.ts";

/**
 * Resolves `compilerOptions.paths` of the project `tsconfig.json` (`typescript.tsConfig`)
 * for project sources. The `alias` option takes precedence.
 *
 * Relative targets of a `typescript.tsConfig` object resolve from `rootDir` (or `baseUrl`),
 * those of a loaded `tsconfig.json` from the config declaring them (`extends`).
 */
export function tsconfigPaths(nitro: Nitro, aliases: Record<string, string>): Plugin | undefined {
  const keys = pathsKeys(nitro);
  if (keys.length === 0) {
    return;
  }
  const tsConfig = nitro.options.typescript.tsConfig;
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
  const normalizedAliases = normalizeAliases(aliases);
  // Only `paths` patterns (`baseUrl` alone would match any bare import)
  const idRE = new RegExp(`^(?:${keys.map(patternRegExp).join("|")})$`);
  return {
    name: "nitro:tsconfig-paths",
    resolveId: {
      // Before the builtin resolvers (Vite), like the `paths` of TypeScript
      order: "pre",
      filter: { id: idRE },
      handler(id, importer, options) {
        if (
          !importer ||
          !idRE.test(id) ||
          SKIP_ID_RE.test(id) ||
          NODE_MODULES_RE.test(importer) ||
          resolveAlias(id, normalizedAliases) !== id
        ) {
          return;
        }
        // Type-only targets (e.g. framework generated) keep the regular resolution
        const candidates = matcher(id).filter((path) => !DTS_RE.test(path));
        const next = (index: number): ReturnType<typeof this.resolve> | undefined =>
          index < candidates.length
            ? (chain(
                this.resolve(candidates[index]!, importer, { ...options, skipSelf: true }),
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
 * calling plugins (patterns without a prefix, like `*`, would include all dependencies).
 */
export function tsconfigPathsNoExternal(nitro: Nitro): RegExp[] {
  const keys = pathsKeys(nitro).filter((key) => !key.startsWith("*"));
  return keys.length > 0 ? [new RegExp(`^(?:${keys.map(patternRegExp).join("|")})$`)] : [];
}

function pathsKeys(nitro: Nitro): string[] {
  if (nitro.options.typescript.tsconfigPaths === false) {
    return [];
  }
  return Object.keys(nitro.options.typescript.tsConfig?.compilerOptions?.paths || {});
}

const NODE_MODULES_RE = /[\\/]node_modules[\\/]/;

const DTS_RE = /\.d\.(?:[^/\\]+\.)?[cm]?ts$/;

// Absolute paths, virtual modules and URL schemes (`node:`, `virtual:`), e.g. for a `*` key
const SKIP_ID_RE = /^(?:[/\\\0]|#nitro\/|[a-zA-Z][\w+.-]*:)/;

function patternRegExp(pattern: string): string {
  return pattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
}
