import type { Nitro } from "nitro/types";
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
  if (!exportsEntry) return;

  nitro.options.virtual["#nitro/virtual/server-entry-exports"] =
    `export * from ${JSON.stringify(exportsEntry)};`;
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
