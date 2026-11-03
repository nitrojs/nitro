import type { Nitro, NitroDepsOptions } from "nitro/types";
import type { ResolvedConfig } from "vite";
import { resolveModulePath } from "exsolve";
import { resolveFromDepPath } from "../../utils/_dep-path.ts";
import { deps } from "../../utils/_deps.ts";
import { ensureDep, importDep, resolveDep } from "../../utils/dep.ts";

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
  /** Throw instead of installing `vite` when it cannot be resolved (the `nitro/vite` plugin). */
  plugin?: boolean;
  /** The `deps` option (`deps.paths.vite` is passed as `path`). */
  deps?: NitroDepsOptions;
}

/**
 * Import `vite` from the user project.
 *
 * Nitro does not depend on `vite` itself: the `vite` builder and the `nitro/vite`
 * plugin are opt-in and the version installed next to the app is the version that runs.
 */
export async function importVite(opts: ViteImportOptions): Promise<typeof import("vite")> {
  _assertPluginVite(opts);
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
  _assertPluginVite(opts);
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

/**
 * The `vite` to use: the one explicitly configured, the one running the `nitro/vite` plugin,
 * or the one of the project root.
 */
export function viteImportOptions(nitro: Nitro): ViteImportOptions {
  return {
    dir: nitro.options.rootDir,
    path: nitro.options.vite?.path || _runningVite.get(nitro),
    plugin: _runningVite.has(nitro),
    deps: nitro.options.deps,
  };
}

/**
 * The `deps.paths` option with the `vite` of {@link viteImportOptions}, so `rolldown` is also
 * resolved through the `vite` running the `nitro/vite` plugin.
 */
export function viteDepPaths(nitro: Nitro): Record<string, string> | undefined {
  const paths = nitro.options.deps?.paths;
  const vite = viteImportOptions(nitro).path;
  return vite && !paths?.vite ? { ...paths, vite } : paths;
}

/** Use the `vite` package running the `nitro/vite` plugin, located from its resolved config. */
export function setRunningVite(nitro: Nitro, config: ResolvedConfig): void {
  let entry = _viteEnvEntry(config);
  if (entry) {
    try {
      _resolveFromPath("vite", { dir: nitro.options.rootDir, path: entry });
    } catch {
      entry = undefined;
    }
  }
  _runningVite.set(nitro, entry);
}

const _runningVite = new WeakMap<Nitro, string | undefined>();

function _assertPluginVite(opts: ViteImportOptions): void {
  const dep = _viteDep(opts);
  if (opts.plugin && !opts.path && !resolveDep(dep.id, dep)) {
    throw new Error(
      `Cannot locate the \`vite\` package running the \`nitro/vite\` plugin, and \`vite\` cannot be resolved from \`${opts.dir}\`. Set the \`vite.path\` option to the running \`vite\` package (e.g. \`import.meta.resolve("vite")\`).`
    );
  }
}

/** Vite aliases `/@vite/env` to `/@fs/<vite package>/dist/client/env.mjs`. */
function _viteEnvEntry(config: ResolvedConfig): string | undefined {
  for (const { replacement } of config.resolve?.alias || []) {
    const path = /^\/@fs\/(.+\/dist\/client\/env\.mjs)$/.exec(replacement)?.[1];
    if (path) {
      return /^[a-z]:\//i.test(path) ? path : `/${path}`;
    }
  }
}

/** Explicit paths are resolved through `ensureDep` too, which checks their version. */
function _viteDep(opts: ViteImportOptions) {
  const id = opts.id || "vite";
  return {
    id,
    dir: opts.dir,
    reason: deps.vite.reason,
    version: deps.vite.version,
    deps: { ...opts.deps, paths: opts.path ? { [id]: opts.path } : undefined },
  };
}

/** Resolve a `vite` export from the explicit `vite` package path. */
export function _resolveFromPath(id: string, { dir, path }: ViteImportOptions): string {
  return resolveFromDepPath(id, { dir, path: path! });
}
