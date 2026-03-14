import escapeRE from "escape-string-regexp";
import type { NitroOptions } from "nitro/types";
import { join } from "pathe";

export async function resolveImportsOptions(options: NitroOptions) {
  // Skip loader entirely if imports disabled
  if (options.imports === false) {
    return;
  }

  options.imports.presets ??= [];

  // Auto imports from utils dirs
  options.imports.dirs ??= [];
  options.imports.dirs.push(...options.scanDirs.map((dir) => join(dir, "utils/**/*")));

  // Normalize exclude
  if (Array.isArray(options.imports.exclude) && options.imports.exclude.length === 0) {
    // Exclude .git and buildDir by default
    options.imports.exclude.push(/[/\\]\.git[/\\]/);
    options.imports.exclude.push(options.buildDir);

    // Exclude all node modules that are not a scanDir
    const scanDirsInNodeModules = options.scanDirs
      .map((dir) => dir.match(/(?<=\/)node_modules\/(.+)$/)?.[1])
      .filter(Boolean) as string[];
    options.imports.exclude.push(
      scanDirsInNodeModules.length > 0
        ? new RegExp(
            `node_modules\\/(?!${scanDirsInNodeModules.map((dir) => escapeRE(dir)).join("|")})`
          )
        : /[/\\]node_modules[/\\]/
    );
  }
}
