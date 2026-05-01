import type { Nitro } from "nitro/types";
import { resolveModulePath } from "exsolve";
import { prettyPath } from "../../utils/fs.ts";

const RESOLVE_EXTENSIONS = [".ts", ".js", ".mts", ".mjs"];

export async function setupEntryExports(nitro: Nitro) {
  const exportsEntry = resolveExportsEntry(nitro);
  if (!exportsEntry) return;

  const originalEntry = nitro.options.entry;

  const virtualEntryId = (nitro.options.entry = "#nitro/virtual/cloudflare-server-entry");
  nitro.options.virtual[virtualEntryId] = /* ts */ `
      export * from "${exportsEntry}";
      export * from "${originalEntry}";
      export { default } from "${originalEntry}";
  `;
}

function resolveExportsEntry(nitro: Nitro) {
  const entry = resolveModulePath(nitro.options.cloudflare?.exports || "./exports.cloudflare.ts", {
    from: nitro.options.rootDir,
    extensions: RESOLVE_EXTENSIONS,
    try: true,
  });

  if (!entry && nitro.options.cloudflare?.exports) {
    nitro.logger.warn(
      `Your custom Cloudflare entrypoint \`${prettyPath(nitro.options.cloudflare.exports)}\` file does not exist.`
    );
  } else if (entry && !nitro.options.cloudflare?.exports) {
    nitro.logger.info(`Detected \`${prettyPath(entry)}\` as Cloudflare entrypoint.`);
  }

  return entry;
}
