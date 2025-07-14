import { existsSync } from "node:fs";
import { resolveNitroPath } from "nitropack/kit";
import { pkgDir } from "nitropack/runtime/meta";
import type { NitroOptions } from "nitropack/types";
import { join, resolve } from "pathe";
import { findWorkspaceDir } from "pkg-types";
import { NitroDefaults } from "../defaults";

export async function resolvePathOptions(options: NitroOptions) {
  options.rootDir = resolve(options.rootDir || ".");
  options.workspaceDir ||= await findWorkspaceDir(options.rootDir).catch(
    () => options.rootDir
  );
  for (const key of ["srcDir", "buildDir"] as const) {
    options[key] = resolve(options.rootDir, options[key] || ".");
  }

  // Add aliases
  options.alias = {
    ...options.alias,
    "~/": join(options.srcDir, "/"),
    "@/": join(options.srcDir, "/"),
    "~~/": join(options.rootDir, "/"),
    "@@/": join(options.rootDir, "/"),
  };

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

  // Normalize app.config file paths
  options.appConfigFiles ??= [];
  options.appConfigFiles = options.appConfigFiles
    .map((file) => _tryResolve(resolveNitroPath(file, options)))
    .filter(Boolean) as string[];

  // Detect app.config from scanDirs
  for (const dir of options.scanDirs) {
    const configFile = _tryResolve("app.config", dir);
    if (configFile && !options.appConfigFiles.includes(configFile)) {
      options.appConfigFiles.push(configFile);
    }
  }
}

function _tryResolve(
  path: string,
  base = ".",
  extensions = ["", ".js", ".ts", ".mjs", ".cjs", ".json"]
): string | undefined {
  path = resolve(base, path);
  if (existsSync(path)) {
    return path;
  }
  for (const ext of extensions) {
    const p = path + ext;
    if (existsSync(p)) {
      return p;
    }
  }
}
