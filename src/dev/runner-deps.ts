import type { RunnerName } from "env-runner";
import type { MiniflareEnvRunnerOptions } from "env-runner/runners/miniflare";
import type { Nitro } from "nitro/types";

import { pathToFileURL } from "node:url";
import { resolveModulePath } from "exsolve";
import { resolve } from "pathe";
import { findNearestFile } from "pkg-types";
import { ensureDep } from "../utils/dep.ts";

type MiniflareRunnerDeps = Pick<
  MiniflareEnvRunnerOptions,
  | "miniflare"
  | "wranglerModule"
  | "wrangler"
  | "wranglerConfigPath"
  | "wranglerEnv"
  | "compatibilityDate"
  | "miniflareOptions"
>;

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

async function resolveMiniflareDeps(nitro: Nitro): Promise<MiniflareRunnerDeps> {
  const { rootDir } = nitro.options;
  const miniflare = await ensureDep({
    id: "miniflare",
    dir: rootDir,
    reason: "the `miniflare` dev runner",
    version: "^4",
  });
  const inline = nitro.options.cloudflare?.wrangler;
  const configPath = await findNearestFile(["wrangler.json", "wrangler.jsonc", "wrangler.toml"], {
    startingFrom: rootDir,
  }).catch(() => undefined);
  return {
    miniflare: miniflare ? pathToFileURL(miniflare) : undefined,
    // Optional: without it, a built-in minimal reader handles plain JSON
    // wrangler configs and inline objects.
    wranglerModule: _resolve("wrangler", rootDir),
    wrangler: inline && Object.keys(inline).length > 0 ? inline : Boolean(configPath),
    wranglerConfigPath: configPath,
    wranglerEnv: nitro.options.cloudflare?.wranglerEnv,
    // The dev bundle imports Node.js built-ins that workerd only provides at recent dates
    compatibilityDate: "latest",
    miniflareOptions: {
      defaultPersistRoot: resolve(rootDir, ".wrangler/state/v3"),
    },
  };
}

function _resolve(id: string, dir: string): URL | undefined {
  const path = resolveModulePath(id, { from: [dir, import.meta.url], try: true });
  return path ? pathToFileURL(path) : undefined;
}
