import { pathToFileURL } from "node:url";
import { resolveModulePath } from "exsolve";
import { resolveFromDepPath } from "../../utils/_dep-path.ts";
import { ensureDep } from "../../utils/dep.ts";

/**
 * Resolve `rolldown` from the user project (or `undefined` if it is not installed).
 *
 * An explicit `deps.paths.rolldown` takes precedence. With strict package managers (pnpm),
 * `rolldown` is often only reachable as a dependency of `vite` (the one of the project, or the
 * explicit `deps.paths.vite`).
 * Not cached, so a `rolldown` installed meanwhile (e.g. on demand by a previous build) is found.
 */
export function resolveRolldown(
  dir: string,
  opts: { paths?: Record<string, string> } = {}
): string | undefined {
  if (opts.paths?.rolldown) {
    return resolveFromDepPath("rolldown", { dir, path: opts.paths.rolldown });
  }
  const vite = opts.paths?.vite
    ? resolveFromDepPath("vite", { dir, path: opts.paths.vite })
    : resolveModulePath("vite", { from: dir, try: true, cache: false });
  return resolveModulePath("rolldown", {
    from: vite ? [dir, vite, import.meta.url] : [dir, import.meta.url],
    try: true,
    cache: false,
  });
}

/**
 * Import `rolldown` from the user project, prompting to install it if missing.
 *
 * Nitro does not depend on `rolldown` itself: the version installed next to the app is the
 * version that runs.
 */
export async function importRolldown(
  dir: string,
  opts: { paths?: Record<string, string> } = {}
): Promise<typeof import("rolldown")> {
  // An explicit path is resolved through `ensureDep` too, which checks its version
  const resolved =
    (!opts.paths?.rolldown && resolveRolldown(dir, opts)) ||
    (await ensureDep({ id: "rolldown", dir, paths: opts.paths }));
  if (!resolved) {
    throw new Error(
      "`rolldown` is not installed. Please add it to your project dependencies to build with the `rolldown` builder."
    );
  }
  return import(pathToFileURL(resolved).href);
}
