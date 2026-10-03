import { pathToFileURL } from "node:url";
import { resolveModulePath } from "exsolve";
import type { OXCOptions } from "nitro/types";
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
 * Uses the native bindings of `rolldown` when it is resolvable from `dir` (the project root), its
 * `vite` or Nitro itself (fast path), and falls back to `oxbox`, a portable wasm build bundled
 * with Nitro.
 *
 * Without `dir`, the last loaded instance is reused (build plugins load it with the project root
 * before any output plugin runs).
 */
export function importOXC(opts: { dir?: string } = {}): Promise<OXC> {
  if (!opts.dir) {
    return _last ?? importOXC({ dir: process.cwd() });
  }
  let oxc = _cache.get(opts.dir);
  if (!oxc) {
    // With strict package managers (pnpm), `rolldown` is often only reachable as a dependency of `vite`
    const vite = resolveModulePath("vite", { from: opts.dir, try: true });
    const rolldownUtils = resolveModulePath("rolldown/utils", {
      from: vite ? [opts.dir, vite, import.meta.url] : [opts.dir, import.meta.url],
      try: true,
    });
    oxc = (
      rolldownUtils
        ? import(pathToFileURL(rolldownUtils).href).catch(() => import("oxbox"))
        : import("oxbox")
    ) as Promise<OXC>;
    _cache.set(opts.dir, oxc);
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
