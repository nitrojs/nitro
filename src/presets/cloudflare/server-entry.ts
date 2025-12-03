import type { Nitro } from "nitro/types";
import { presetsDir } from "nitro/meta";
import { resolveModulePath } from "exsolve";
import { resolveNitroPath, prettyPath } from "../../utils/fs.ts";
import { resolveModuleExportNames } from "mlly";

const RESOLVE_EXTENSIONS = [".ts", ".js", ".mts", ".mjs"];

export async function maybeServerEntry(nitro: Nitro, durable: boolean = false) {
  const entrypoint = resolveEntrypoint(nitro);
  if (!entrypoint) return;

  const entryExports = await resolveModuleExportNames(entrypoint);
  if (entryExports.includes("default")) {
    throw new Error(
      `Unsupported Cloudflare entrypoint \`${prettyPath(entrypoint)}\` exports default.`
    );
  }

  const internalEntry = resolveModulePath(nitro.options.entry, {
    from: [presetsDir, nitro.options.rootDir, ...nitro.options.scanDirs],
    extensions: RESOLVE_EXTENSIONS,
  })!;

  const exports = await resolveModuleExportNames(internalEntry);
  const id = (nitro.options.entry =
    "#nitro-internal-virtual/cloudflare-server-entry");
  nitro.options.virtual[id] = `/* ts */
      export { ${entryExports.join(", ")} } from "${entrypoint}";
      export { ${exports.join(", ")} } from "${internalEntry}";
  `;
}

function resolveEntrypoint(nitro: Nitro) {
  const entry = resolveModulePath(
    resolveNitroPath(
      nitro.options.cloudflare?.entrypoint ?? "cloudflare",
      nitro.options
    ),
    {
      from: nitro.options.rootDir,
      extensions: RESOLVE_EXTENSIONS,
      try: true,
    }
  );

  if (!entry && nitro.options.cloudflare?.entrypoint) {
    nitro.logger.warn(
      `Your custom Cloudflare entrypoint \`${prettyPath(nitro.options.cloudflare.entrypoint)}\` file does not exist.`
    );
  } else if (entry && !nitro.options.cloudflare?.entrypoint) {
    nitro.logger.info(
      `Detected \`${prettyPath(entry)}\` as Cloudflare entrypoint.`
    );
  }

  return entry;
}
