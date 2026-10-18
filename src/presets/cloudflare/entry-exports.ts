import type { Nitro } from "nitro/types";
import type { WranglerConfig } from "./types.ts";
import { join } from "pathe";
import { presetsDir } from "#nitro/meta";
import { readWranglerConfig } from "./utils.ts";

// Named exports of the server entry (e.g. Durable Objects) are Worker exports
export function setupEntryExports(nitro: Nitro) {
  const serverEntry = nitro.options.serverEntry && nitro.options.serverEntry.handler;
  if (!serverEntry) return;

  const originalEntry = nitro.options.entry;
  const virtualEntryId = (nitro.options.entry = "#nitro/virtual/cloudflare-server-entry");
  nitro.options.virtual[virtualEntryId] = /* js */ `
    export * from ${JSON.stringify(serverEntry)};
    export * from ${JSON.stringify(originalEntry)};
    export { default } from ${JSON.stringify(originalEntry)};
  `;
}

/**
 * Export the built-in `$DurableObject` class in dev, like the `cloudflare-module` entry, when the
 * Wrangler config declares it (the miniflare runner warns about undeclared Durable Objects).
 */
export async function setupDevDurableExport(nitro: Nitro) {
  if (!(await _declaresDurableObject(nitro))) return;
  const durable = JSON.stringify(join(presetsDir, "cloudflare/runtime/_durable"));
  if (nitro.options.builder === "vite") {
    // Re-exported to the nitro environment's entry by `#nitro/virtual/server-entry`
    nitro.options.virtual["#nitro/virtual/dev-worker-exports"] =
      `export { $DurableObject } from ${durable};`;
    return;
  }
  const originalEntry = nitro.options.entry;
  const virtualEntryId = (nitro.options.entry = "#nitro/virtual/cloudflare-dev-entry");
  nitro.options.virtual[virtualEntryId] = /* js */ `
    export * from ${JSON.stringify(originalEntry)};
    export { default } from ${JSON.stringify(originalEntry)};
    export { $DurableObject } from ${durable};
  `;
}

// Bound or exported in the selected environment of the Wrangler config file or inline config
async function _declaresDurableObject(nitro: Nitro): Promise<boolean> {
  const { config = {} } = await readWranglerConfig(nitro).catch(() => ({ config: undefined }));
  const envName = nitro.options.cloudflare?.wranglerEnv ?? process.env.CLOUDFLARE_ENV;
  return [config, nitro.options.cloudflare?.wrangler || {}].some((source: WranglerConfig) => {
    const target = (envName && source.env?.[envName]) || source;
    return (
      !!target.exports?.$DurableObject ||
      !!target.durable_objects?.bindings?.some(
        (binding) => binding.class_name === "$DurableObject" && !binding.script_name
      )
    );
  });
}
