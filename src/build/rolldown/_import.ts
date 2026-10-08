import { pathToFileURL } from "node:url";
import { resolveModulePath } from "exsolve";
import { ensureDep } from "../../utils/dep.ts";
import { _resolveFromPath } from "../vite/_import.ts";

/** Supported `rolldown` version range. */
export const ROLLDOWN_VERSION = "^1";

/**
 * Resolve `rolldown` from the user project (or `undefined` if it is not installed).
 *
 * With strict package managers (pnpm), `rolldown` is often only reachable as a dependency of `vite`
 * (the one of the project, or the explicit `vite.path`).
 * Not cached, so a `rolldown` installed meanwhile (e.g. on demand by a previous build) is found.
 */
export function resolveRolldown(dir: string, opts: { vitePath?: string } = {}): string | undefined {
  const vite = opts.vitePath
    ? _resolveFromPath("vite", { dir, path: opts.vitePath })
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
export async function importRolldown(dir: string): Promise<typeof import("rolldown")> {
  const resolved =
    resolveRolldown(dir) ||
    (await ensureDep({
      id: "rolldown",
      dir,
      reason: "the `rolldown` builder",
      version: ROLLDOWN_VERSION,
    }));
  if (!resolved) {
    throw new Error(
      "`rolldown` is not installed. Please add it to your project dependencies to build with the `rolldown` builder."
    );
  }
  return import(pathToFileURL(resolved).href);
}
