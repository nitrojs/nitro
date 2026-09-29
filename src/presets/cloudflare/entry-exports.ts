import type { Nitro } from "nitro/types";
import { readFile } from "node:fs/promises";
import { resolveModulePath } from "exsolve";
import { prettyPath } from "../../utils/fs.ts";

const RESOLVE_EXTENSIONS = [".ts", ".js", ".mts", ".mjs"];

export async function setupEntryExports(nitro: Nitro, opts: { entry?: boolean } = {}) {
  const exportsEntry = resolveExportsEntry(nitro);
  if (!exportsEntry && nitro.options.cloudflare?.exports) {
    nitro.logger.warn(
      `Your custom Cloudflare entrypoint \`${prettyPath(nitro.options.cloudflare.exports)}\` file does not exist.`
    );
  } else if (exportsEntry && !nitro.options.cloudflare?.exports) {
    nitro.logger.info(`Detected \`${prettyPath(exportsEntry)}\` as Cloudflare entrypoint.`);
  }
  if (!exportsEntry && !serverEntryHandler(nitro)) return;

  // Named exports of the server entry (e.g. Durable Objects) are Worker exports
  nitro.options.virtual["#nitro/virtual/server-entry-exports"] = async () => {
    const serverEntry = serverEntryHandler(nitro);
    const sources = [
      exportsEntry,
      serverEntry && (await hasNamedExports(serverEntry)) ? serverEntry : undefined,
    ].filter(Boolean);
    return sources.map((id) => `export * from ${JSON.stringify(id)};`).join("\n") || "export {};";
  };
  if (opts.entry === false) return;

  const originalEntry = nitro.options.entry;
  const virtualEntryId = (nitro.options.entry = "#nitro/virtual/cloudflare-server-entry");
  nitro.options.virtual[virtualEntryId] = /* js */ `
    export * from "#nitro/virtual/server-entry-exports";
    export * from ${JSON.stringify(originalEntry)};
    export { default } from ${JSON.stringify(originalEntry)};
  `;
}

export function resolveExportsEntry(nitro: Nitro) {
  return resolveModulePath(nitro.options.cloudflare?.exports || "./exports.cloudflare.ts", {
    from: nitro.options.rootDir,
    extensions: RESOLVE_EXTENSIONS,
    try: true,
  });
}

export function serverEntryHandler(nitro: Nitro): string | undefined {
  return (nitro.options.serverEntry && nitro.options.serverEntry.handler) || undefined;
}

// Avoids bundling the server entry separately (Vite dev) when it only has a default export
async function hasNamedExports(file: string): Promise<boolean> {
  try {
    const { parseSync } = await import("rolldown/utils");
    const { module } = parseSync(file, await readFile(file, "utf8"));
    return module.staticExports.some((e) =>
      e.entries.some(
        (entry) =>
          !entry.isType &&
          entry.exportName.kind !== "Default" &&
          entry.exportName.name !== "default"
      )
    );
  } catch {
    return true;
  }
}
