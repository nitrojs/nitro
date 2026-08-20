import type { RunnerName } from "env-runner";
import type { Nitro } from "nitro/types";

import { pathToFileURL } from "node:url";
import { resolveModulePath } from "exsolve";
import { ensureDep } from "../utils/dep.ts";

export interface MiniflareRunnerDeps {
  miniflare?: URL;
  wranglerModule?: URL;
  [key: string]: unknown;
}

/**
 * Resolve the platform packages a dev runner needs from the user project.
 *
 * Runners do not import these packages themselves: each one is passed as an
 * explicit option so the version installed next to the app is the version that
 * runs. Unresolved entries are left out and the runner falls back to its own
 * optional import (or a degraded mode).
 */
export async function resolveRunnerDeps(
  nitro: Nitro,
  runner: RunnerName
): Promise<Record<string, unknown>> {
  switch (runner) {
    case "miniflare": {
      return resolveMiniflareDeps(nitro);
    }
    case "netlify": {
      // `@netlify/runtime` is instantiated inside the worker thread, so it can
      // only be handed over as a specifier, never as an imported module.
      return { netlifyRuntime: _resolve("@netlify/runtime", nitro.options.rootDir) };
    }
    default: {
      return {};
    }
  }
}

export async function resolveMiniflareDeps(nitro: Nitro): Promise<MiniflareRunnerDeps> {
  const miniflare = await ensureDep({
    id: "miniflare",
    dir: nitro.options.rootDir,
    reason: "the `miniflare` dev runner",
    version: "^4",
  });
  return {
    miniflare: miniflare ? pathToFileURL(miniflare) : undefined,
    // Optional: without it, a built-in minimal reader handles plain JSON
    // wrangler configs and inline objects.
    wranglerModule: _resolve("wrangler", nitro.options.rootDir),
  };
}

function _resolve(id: string, dir: string): URL | undefined {
  const path = resolveModulePath(id, { from: [dir, import.meta.url], try: true });
  return path ? pathToFileURL(path) : undefined;
}
