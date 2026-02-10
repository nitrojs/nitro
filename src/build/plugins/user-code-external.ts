import type { Plugin } from "rollup";
import type { Nitro } from "nitro/types";
import { isAbsolute, relative } from "pathe";
import { presetsDir, runtimeDir } from "nitro/meta";

export const BUILDERLESS_EXTERNAL_MARKER = "nitro:user-code-external";

export function userCodeExternal(nitro: Nitro): Plugin {
  const includeRoots = [...new Set([nitro.options.rootDir, ...nitro.options.scanDirs])];
  const excludeRoots = [
    runtimeDir,
    presetsDir,
    nitro.options.buildDir,
    nitro.options.output.dir,
    nitro.options.output.serverDir,
    nitro.options.output.publicDir,
  ];

  const shouldExternalize = (id: string) => {
    if (!isAbsolute(id) || isNodeModulesPath(id)) {
      return false;
    }
    if (!includeRoots.some((root) => isSubpath(id, root))) {
      return false;
    }
    return !excludeRoots.some((root) => isSubpath(id, root));
  };

  return {
    name: BUILDERLESS_EXTERNAL_MARKER,
    resolveId: {
      order: "pre",
      handler(id) {
        const [path] = splitSpecifier(id);
        if (!path || !shouldExternalize(path)) {
          return null;
        }
        return {
          id,
          external: true,
          moduleSideEffects: true,
        };
      },
    },
  };
}

function splitSpecifier(specifier: string) {
  const queryIndex = specifier.indexOf("?");
  if (queryIndex < 0) {
    return [specifier, ""] as const;
  }
  return [specifier.slice(0, queryIndex), specifier.slice(queryIndex)] as const;
}

function isNodeModulesPath(path: string) {
  return /[/\\]node_modules[/\\]/.test(path);
}

function isSubpath(path: string, parent: string) {
  const rel = relative(parent, path);
  return !rel || (!rel.startsWith("..") && !isAbsolute(rel));
}
