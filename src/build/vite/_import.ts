import type { Nitro } from "nitro/types";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveModulePath } from "exsolve";
import { dirname, join, resolve } from "pathe";
import { ensureDep, importDep } from "../../utils/dep.ts";

export interface ViteImportOptions {
  /** Directory to resolve `vite` from (the project root). */
  dir: string;
  /** Package name to resolve instead of `vite` (testing). */
  id?: string;
  /**
   * Explicit `vite` package to use instead of resolving it: its directory or entry,
   * as a path or `file://` URL (the `vite.path` option).
   */
  path?: string;
}

/**
 * Import `vite` from the user project.
 *
 * Nitro does not depend on `vite` itself: the `vite` builder and the `nitro/vite`
 * plugin are opt-in and the version installed next to the app is the version that runs.
 */
export async function importVite(opts: ViteImportOptions): Promise<typeof import("vite")> {
  if (opts.path) {
    return import(pathToFileURL(_resolveFromPath("vite", opts)).href);
  }
  return importDep<typeof import("vite")>(_viteDep(opts));
}

/**
 * Resolve `vite/module-runner` from the user project.
 *
 * The dev worker cannot import it by name: it is loaded from Nitro's own `dist/`, where the
 * optional `vite` dependency is not resolvable. The path is injected into the generated worker
 * entry instead (see `_dev-worker.ts`).
 */
export async function resolveViteModuleRunner(opts: ViteImportOptions): Promise<string> {
  if (opts.path) {
    return _resolveFromPath("vite/module-runner", opts);
  }
  const viteEntry = await ensureDep(_viteDep(opts));
  const moduleRunner =
    viteEntry &&
    resolveModulePath("vite/module-runner", {
      from: [viteEntry, opts.dir, import.meta.url],
      try: true,
    });
  if (!moduleRunner) {
    throw new Error("Cannot resolve `vite/module-runner`. Is `vite` installed in your project?");
  }
  return moduleRunner;
}

/** The `vite` to use: the one explicitly configured, or the one of the project root. */
export function viteImportOptions(nitro: Nitro): ViteImportOptions {
  return { dir: nitro.options.rootDir, path: nitro.options.vite?.path };
}

function _viteDep(opts: ViteImportOptions) {
  return {
    id: opts.id || "vite",
    dir: opts.dir,
    reason: "the `vite` builder",
    version: "^8",
  };
}

/** Resolve a `vite` export from an explicit package path (self-referencing its `exports`). */
export function _resolveFromPath(id: string, { dir, path }: ViteImportOptions): string {
  const from = path!.startsWith("file:") ? fileURLToPath(path!) : resolve(dir, path!);
  const isDir = statSync(from, { throwIfNoEntry: false })?.isDirectory();
  const pkgDir = _findPackageDir(isDir ? from : dirname(from), "vite");
  const resolved = pkgDir && resolveModulePath(id, { from: join(pkgDir, "/"), try: true });
  if (!resolved) {
    throw new Error(
      `Cannot resolve \`${id}\` from \`${path}\`. The \`vite.path\` option must point to the \`vite\` package directory or entry.`
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
