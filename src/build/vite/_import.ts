import type { Nitro } from "nitro/types";
import { resolveModulePath } from "exsolve";
import { resolveFromDepPath } from "../../utils/_dep-path.ts";
import { deps } from "../../utils/_deps.ts";
import { ensureDep, importDep } from "../../utils/dep.ts";

export interface ViteImportOptions {
  /** Directory to resolve `vite` from (the project root). */
  dir: string;
  /** Package name to resolve instead of `vite` (testing). */
  id?: string;
  /**
   * Explicit `vite` package to use instead of resolving it: its directory or entry,
   * as a path or `file://` URL (the `vite.path` or `deps.paths.vite` option).
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
  const viteEntry = await ensureDep(_viteDep(opts));
  if (viteEntry && opts.path) {
    return _resolveFromPath("vite/module-runner", opts);
  }
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

/** Explicit paths are resolved through `ensureDep` too, which checks their version. */
function _viteDep(opts: ViteImportOptions) {
  const id = opts.id || "vite";
  return {
    id,
    dir: opts.dir,
    reason: deps.vite.reason,
    version: deps.vite.version,
    paths: opts.path ? { [id]: opts.path } : undefined,
  };
}

/** Resolve a `vite` export from the explicit `vite` package path. */
export function _resolveFromPath(id: string, { dir, path }: ViteImportOptions): string {
  return resolveFromDepPath(id, { dir, path: path! });
}
