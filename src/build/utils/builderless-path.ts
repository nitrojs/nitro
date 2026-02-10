import type { Nitro } from "nitro/types";
import { presetsDir, runtimeDir } from "nitro/meta";
import { isAbsolute, relative } from "pathe";

export function splitSpecifier(specifier: string) {
  const queryIndex = specifier.indexOf("?");
  if (queryIndex < 0) {
    return [specifier, ""] as const;
  }
  return [specifier.slice(0, queryIndex), specifier.slice(queryIndex)] as const;
}

export function isNodeModulesPath(path: string) {
  return /[/\\]node_modules[/\\]/.test(path);
}

export function isSubpath(path: string, parent: string) {
  const rel = relative(parent, path);
  return !rel || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function isBuilderlessUserCodePath(path: string, nitro: Nitro) {
  if (!isAbsolute(path) || isNodeModulesPath(path)) {
    return false;
  }
  if (isSubpath(path, runtimeDir) || isSubpath(path, presetsDir)) {
    return false;
  }

  const includeRoots = [...new Set([nitro.options.rootDir, ...nitro.options.scanDirs])];
  const excludeRoots = [
    nitro.options.buildDir,
    nitro.options.output.dir,
    nitro.options.output.serverDir,
    nitro.options.output.publicDir,
  ];

  if (!includeRoots.some((root) => isSubpath(path, root))) {
    return false;
  }
  return !excludeRoots.some((root) => isSubpath(path, root));
}
