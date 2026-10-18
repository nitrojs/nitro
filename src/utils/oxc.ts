import { pathToFileURL } from "node:url";
import { resolveModulePath } from "exsolve";
import type { OXCOptions } from "nitro/types";
import { resolveFromDepPath } from "./_dep-path.ts";
import type { parseSync, transformSync } from "oxbox";
import type { minifySync } from "rolldown/utils";

export interface OXC {
  parseSync: typeof parseSync;
  transformSync: (
    filename: string,
    sourceText: string,
    // `tsconfig` is only supported by rolldown (oxbox ignores it)
    options?: OXCOptions["transform"] & { sourcemap?: boolean; tsconfig?: false }
  ) => ReturnType<typeof transformSync>;
  /** Only available with `rolldown` (oxbox has no minifier). */
  minifySync?: typeof minifySync;
}

const _cache = new Map<string, Promise<OXC>>();
let _last: Promise<OXC> | undefined;

/**
 * Load the oxc parser and transformer.
 *
 * Uses the native bindings of `rolldown` when it is resolvable from its explicit path (`paths`),
 * `dir` (the project root), its `vite` or Nitro itself (fast path), and falls back to `oxbox`, a
 * portable wasm build bundled with Nitro.
 *
 * Without `dir`, the last loaded instance is reused (build plugins load it with the project root
 * before any output plugin runs).
 */
export function importOXC(
  opts: { dir?: string; paths?: Record<string, string> } = {}
): Promise<OXC> {
  if (!opts.dir) {
    return _last ?? importOXC({ dir: process.cwd() });
  }
  const { dir, paths } = opts;
  const key = [dir, paths?.rolldown, paths?.vite].join("\0");
  let oxc = _cache.get(key);
  if (!oxc) {
    const rolldownUtils = _resolveRolldownUtils(dir, paths);
    oxc = (
      rolldownUtils
        ? import(pathToFileURL(rolldownUtils).href).catch(() => import("oxbox"))
        : import("oxbox")
    ) as Promise<OXC>;
    _cache.set(key, oxc);
  }
  return (_last = oxc);
}

/** Call `visit` for every node of an ESTree AST, depth first. */
export function walkAST<T extends { type: string }>(node: unknown, visit: (node: T) => void): void {
  if (Array.isArray(node)) {
    for (const child of node) {
      walkAST(child, visit);
    }
    return;
  }
  if (!node || typeof node !== "object") {
    return;
  }
  const record = node as Record<string, unknown>;
  if (typeof record.type === "string") {
    visit(node as T);
  }
  for (const key in record) {
    if (key !== "parent") {
      walkAST(record[key], visit);
    }
  }
}

function _resolveRolldownUtils(dir: string, paths?: Record<string, string>): string | undefined {
  if (paths?.rolldown) {
    return resolveFromDepPath("rolldown/utils", { dir, path: paths.rolldown });
  }
  // With strict package managers (pnpm), `rolldown` is often only reachable as a dependency of `vite`
  const vite = paths?.vite
    ? resolveFromDepPath("vite", { dir, path: paths.vite })
    : resolveModulePath("vite", { from: dir, try: true });
  return resolveModulePath("rolldown/utils", {
    from: vite ? [dir, vite, import.meta.url] : [dir, import.meta.url],
    try: true,
  });
}
