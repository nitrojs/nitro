import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolveModulePath } from "exsolve";
import { dirname, join, resolve } from "pathe";

/** Package name of an import specifier (`unstorage/tracing` → `unstorage`). */
export function depPackageName(id: string): string {
  const parts = id.split("/");
  return id.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
}

/**
 * Resolve a package (or one of its subpaths, self-referencing its `exports`) from an explicit
 * package path (the `deps` option): its directory or entry, as a path or `file://` URL.
 */
export function resolveFromDepPath(id: string, opts: { dir: string; path: string }): string {
  const name = depPackageName(id);
  const from = opts.path.startsWith("file:")
    ? fileURLToPath(opts.path)
    : resolve(opts.dir, opts.path);
  const isDir = statSync(from, { throwIfNoEntry: false })?.isDirectory();
  const pkgDir = _findPackageDir(isDir ? from : dirname(from), name);
  const resolved = pkgDir && resolveModulePath(id, { from: join(pkgDir, "/"), try: true });
  if (!resolved) {
    throw new Error(
      `Cannot resolve \`${id}\` from \`${opts.path}\`. The \`deps["${name}"]\` option must point to the \`${name}\` package directory or entry.`
    );
  }
  return resolved;
}

/** Find the directory of the package named `name` containing `dir`. */
function _findPackageDir(dir: string, name: string): string | undefined {
  for (let depth = 0; depth < 10; depth++) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        if (JSON.parse(readFileSync(pkgPath, "utf8")).name === name) {
          return dir;
        }
      } catch {
        // Ignore unreadable or invalid `package.json` files
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return;
    }
    dir = parent;
  }
}
