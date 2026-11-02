import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolveModulePath } from "exsolve";
import { dirname, isAbsolute, join, relative, resolve } from "pathe";

/** Package name of an import specifier (`unstorage/tracing` → `unstorage`). */
export function depPackageName(id: string): string {
  const parts = id.split("/");
  return id.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
}

/**
 * Resolve a package (or one of its subpaths) from an explicit package path (the `deps.paths`
 * option): its directory or entry, as a path or `file://` URL.
 *
 * Only files of that package are returned, never another copy resolvable from its location.
 */
export function resolveFromDepPath(id: string, opts: { dir: string; path: string }): string {
  const name = depPackageName(id);
  const from = opts.path.startsWith("file:")
    ? fileURLToPath(opts.path)
    : resolve(opts.dir, opts.path);
  const isDir = statSync(from, { throwIfNoEntry: false })?.isDirectory();
  const pkgDir = _findPackageDir(isDir ? from : dirname(from), name);
  if (!pkgDir) {
    throw new Error(
      `Cannot resolve \`${id}\` from \`${opts.path}\`. The \`deps.paths["${name}"]\` option must point to the \`${name}\` package directory or entry.`
    );
  }
  const resolved = _resolveInPackage(id, name, pkgDir);
  if (!resolved) {
    throw new Error(
      `Cannot resolve \`${id}\` in the \`${name}\` package at \`${pkgDir}\` (the \`deps.paths["${name}"]\` option).`
    );
  }
  return resolved;
}

function _resolveInPackage(id: string, name: string, pkgDir: string): string | undefined {
  // Self-reference, applying the `exports` of the package
  const resolved = resolveModulePath(id, { from: join(pkgDir, "/"), try: true });
  if (resolved && _isInside(resolved, pkgDir)) {
    return resolved;
  }
  // Packages without `exports` cannot reference themselves: resolve their files directly
  const subpath = id.slice(name.length + 1) || _readPackageJSON(pkgDir)?.main || "index";
  const file = resolveModulePath(join(pkgDir, subpath), {
    try: true,
    extensions: [".mjs", ".js", ".cjs", ".json"],
    suffixes: ["", "/index"],
  });
  return file && _isInside(file, pkgDir) ? file : undefined;
}

function _isInside(file: string, dir: string): boolean {
  const path = relative(realpathSync(dir), realpathSync(file));
  return !!path && !path.startsWith("..") && !isAbsolute(path);
}

/** Find the directory of the package named `name` containing `dir`. */
function _findPackageDir(dir: string, name: string): string | undefined {
  for (let depth = 0; depth < 10; depth++) {
    if (_readPackageJSON(dir)?.name === name) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return;
    }
    dir = parent;
  }
}

function _readPackageJSON(dir: string): { name?: string; main?: string } | undefined {
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) {
    return;
  }
  try {
    return JSON.parse(readFileSync(pkgPath, "utf8"));
  } catch {
    // Ignore unreadable or invalid `package.json` files
  }
}
