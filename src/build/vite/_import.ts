import { resolveModulePath } from "exsolve";
import { ensureDep, importDep } from "../../utils/dep.ts";

/**
 * Import `vite` from the user project.
 *
 * Nitro does not depend on `vite` itself: the `vite` builder and the `nitro/vite`
 * plugin are opt-in and the version installed next to the app is the version that runs.
 */
export function importVite(opts: { dir: string; id?: string }): Promise<typeof import("vite")> {
  return importDep<typeof import("vite")>(_viteDep(opts));
}

/**
 * Resolve `vite/module-runner` from the user project.
 *
 * The dev worker cannot import it by name: it is loaded from Nitro's own `dist/`, where the
 * optional `vite` dependency is not resolvable. The path is injected into the generated worker
 * entry instead (see `_dev-worker.ts`).
 */
export async function resolveViteModuleRunner(dir: string): Promise<string> {
  const viteEntry = await ensureDep(_viteDep({ dir }));
  const moduleRunner =
    viteEntry &&
    resolveModulePath("vite/module-runner", {
      from: [viteEntry, dir, import.meta.url],
      try: true,
    });
  if (!moduleRunner) {
    throw new Error("Cannot resolve `vite/module-runner`. Is `vite` installed in your project?");
  }
  return moduleRunner;
}

function _viteDep(opts: { dir: string; id?: string }) {
  return {
    id: opts.id || "vite",
    dir: opts.dir,
    reason: "the `vite` builder",
    version: "^8",
  };
}
