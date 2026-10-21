import type { Nitro } from "nitro/types";
import type { Plugin } from "rollup";
import { createPathsMatcher } from "get-tsconfig";
import { join } from "pathe";
import { resolveAlias } from "pathe/utils";
import { chain } from "../../utils/sync.ts";

/**
 * Resolves `compilerOptions.paths` of the project `tsconfig.json` (`typescript.tsConfig`)
 * for project sources. The `alias` option takes precedence.
 */
export function tsconfigPaths(nitro: Nitro, aliases: Record<string, string>): Plugin | undefined {
  if (nitro.options.typescript.tsconfigPaths === false) {
    return;
  }
  const tsConfig = nitro.options.typescript.tsConfig;
  const keys = Object.keys(tsConfig?.compilerOptions?.paths || {});
  const matcher =
    keys.length > 0 &&
    createPathsMatcher({
      path: join(nitro.options.rootDir, "tsconfig.json"),
      config: tsConfig as Parameters<typeof createPathsMatcher>[0]["config"],
    });
  if (!matcher) {
    return;
  }
  return {
    name: "nitro:tsconfig-paths",
    resolveId: {
      // Only `paths` patterns (`baseUrl` alone would match any bare import)
      filter: { id: new RegExp(`^(?:${keys.map(patternRegExp).join("|")})$`) },
      handler(id, importer, options) {
        if (!importer || NODE_MODULES_RE.test(importer) || resolveAlias(id, aliases) !== id) {
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

const NODE_MODULES_RE = /[\\/]node_modules[\\/]/;

const DTS_RE = /\.d\.[cm]?ts$/;

function patternRegExp(pattern: string): string {
  return pattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
}
