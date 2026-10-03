import type { Nitro } from "nitro/types";

import { pathToFileURL } from "node:url";
import { resolveModulePath } from "exsolve";
import { pkgDir } from "nitro/meta";
import { join, resolve } from "pathe";
import { baseBuildConfig } from "../config.ts";
import { virtualTemplates } from "../virtual/_all.ts";

export const NITRO_VIRTUAL_PREFIX = "#nitro/virtual/";

export interface UnbundledApp {
  /** Path of the (virtual) entry the runner loads. */
  entry: string;
  /** Virtual modules for the runner (`data.virtual`). */
  virtual: Record<string, string>;
}

/**
 * Prepare the entry and virtual modules to run the server sources without a builder.
 *
 * `#nitro/virtual/*` modules are keyed by the file path the Nitro package maps them to
 * (`dist/runtime/virtual/*.mjs`), so env-runner serves them as that file and their imports
 * (`#nitro/runtime/*`, runtime dependencies) resolve from the Nitro package, like real files.
 * Each of them has a stub file there, so runtimes resolve `#nitro/virtual/*` natively.
 *
 * Also exposes the virtual templates as `nitro.vfs` for the `/_vfs` debug endpoint.
 */
export async function prepareUnbundledApp(nitro: Nitro): Promise<UnbundledApp> {
  const { env, extensions } = await baseBuildConfig(nitro);

  const templates = virtualTemplates(nitro, [...env.polyfills]);
  nitro.vfs = new Map(
    templates.map((t) => [
      t.id,
      { render: () => (typeof t.template === "function" ? t.template() : t.template) },
    ])
  );

  const virtual: Record<string, string> = Object.fromEntries(
    await Promise.all(
      [...nitro.vfs].map(async ([id, mod]) => {
        const key = id.startsWith(NITRO_VIRTUAL_PREFIX) ? nitroVirtualPath(id) : id;
        return [key, await mod.render()] as const;
      })
    )
  );

  const entry = resolve(nitro.options.output.serverDir, "index.mjs");
  const appEntry = pathToFileURL(
    resolveModulePath(nitro.options.entry, { from: nitro.options.rootDir, extensions })
  ).href;
  virtual[entry] = /* js */ `
globalThis.__nitro_main__ = import.meta.url;
export * from ${JSON.stringify(appEntry)};
export { default } from ${JSON.stringify(appEntry)};
`.trimStart();

  return { entry, virtual };
}

/**
 * File path the Nitro package maps a `#nitro/virtual/*` id to (`dist/runtime/virtual/*.mjs`).
 *
 * Without an id, the directory of these files.
 */
export function nitroVirtualPath(id: string): string {
  const dir = join(pkgDir, "dist/runtime/virtual/");
  return id ? join(dir, `${id.slice(NITRO_VIRTUAL_PREFIX.length)}.mjs`) : dir;
}
