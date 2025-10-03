import { existsSync } from "node:fs";
import { resolveNitroPath } from "../../utils/fs";
import { pkgDir } from "nitro/runtime/meta";
import type { NitroOptions } from "nitro/types";
import { join, resolve } from "pathe";
import { findWorkspaceDir } from "pkg-types";
import { NitroDefaults } from "../defaults";
import { resolveModulePath } from "exsolve";

export async function resolvePathOptions(options: NitroOptions) {
  options.rootDir = resolve(options.rootDir || ".");
  options.workspaceDir ||= await findWorkspaceDir(options.rootDir).catch(
    () => options.rootDir
  );
  for (const key of ["srcDir", "buildDir"] as const) {
    options[key] = resolve(options.rootDir, options[key] || ".");
  }
  options.alias ??= {};

  // Resolve possibly template paths
  if (!options.static && !options.entry) {
    throw new Error(
      `Nitro entry is missing! Is "${options.preset}" preset correct?`
    );
  }
  if (options.entry) {
    options.entry = resolveNitroPath(options.entry, options);
  }
  options.output.dir = resolveNitroPath(
    options.output.dir || NitroDefaults.output!.dir!,
    options,
    options.rootDir
  );
  options.output.publicDir = resolveNitroPath(
    options.output.publicDir || NitroDefaults.output!.publicDir!,
    options,
    options.rootDir
  );
  options.output.serverDir = resolveNitroPath(
    options.output.serverDir || NitroDefaults.output!.serverDir!,
    options,
    options.rootDir
  );

  options.nodeModulesDirs.push(resolve(options.workspaceDir, "node_modules"));
  options.nodeModulesDirs.push(resolve(options.rootDir, "node_modules"));
  options.nodeModulesDirs.push(resolve(pkgDir, "node_modules"));
  options.nodeModulesDirs.push(resolve(pkgDir, "..")); // pnpm
  options.nodeModulesDirs = [
    ...new Set(
      // Adding trailing slash to optimize resolve performance (path is explicitly a dir)
      options.nodeModulesDirs.map((dir) => resolve(options.rootDir, dir) + "/")
    ),
  ];

  // Resolve plugin paths
  options.plugins = options.plugins.map((p) => resolveNitroPath(p, options));

  // Resolve scanDirs
  options.scanDirs.unshift(options.srcDir);
  options.scanDirs = options.scanDirs.map((dir) =>
    resolve(options.srcDir, dir)
  );
  options.scanDirs = [...new Set(options.scanDirs)];

  // Resolve custom renderer entry
  if (options.renderer?.entry) {
    options.renderer.entry = resolveModulePath(
      resolveNitroPath(options.renderer?.entry, options),
      {
        from: options.scanDirs,
        extensions: [".ts", ".js", ".mts", ".mjs", ".tsx", ".jsx"],
      }
    );
  }

  // Resolve custom renderer template
  if (options.renderer?.template) {
    options.renderer.template = resolveModulePath(
      resolveNitroPath(options.renderer?.template, options),
      {
        from: options.scanDirs,
        extensions: [".html"],
      }
    )!;
  }
}
