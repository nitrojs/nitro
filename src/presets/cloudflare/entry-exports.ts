import type { Nitro } from "nitro/types";
import { readFile } from "node:fs/promises";
import { presetsDir } from "nitro/meta";
import { resolveModulePath } from "exsolve";
import { parseSync } from "oxc-parser";
import { resolveNitroPath, prettyPath } from "../../utils/fs.ts";

const RESOLVE_EXTENSIONS = [".ts", ".js", ".mts", ".mjs"];
const DEFAULT_DETECTD_EXPORTS_FILENAME = "exports.cloudflare";

export async function setupEntryExports(nitro: Nitro) {
  const exportsEntry = resolveExportsEntry(nitro);
  if (!exportsEntry) return;

  const exports = await resolveModuleExportNames(exportsEntry);
  if (exports.includes("default")) {
    throw new Error(
      `Unsupported Cloudflare exports entry \`${prettyPath(exportsEntry)}\` exports default.`
    );
  }

  const serverEntry = resolveModulePath(nitro.options.entry, {
    from: [presetsDir, nitro.options.rootDir, ...nitro.options.scanDirs],
    extensions: RESOLVE_EXTENSIONS,
  });

  const serverEntryExports = await resolveModuleExportNames(serverEntry);
  const id = (nitro.options.entry =
    "#nitro-internal-virtual/cloudflare-server-entry");
  nitro.options.virtual[id] = `/* ts */
      export * from "${exportsEntry}";
      export { ${serverEntryExports.join(", ")} } from "${serverEntry}";
  `;
}

function resolveExportsEntry(nitro: Nitro) {
  const entry = resolveModulePath(
    resolveNitroPath(
      nitro.options.cloudflare?.exports ?? DEFAULT_DETECTD_EXPORTS_FILENAME,
      nitro.options
    ),
    {
      from: nitro.options.rootDir,
      extensions: RESOLVE_EXTENSIONS,
      try: true,
    }
  );

  if (!entry && nitro.options.cloudflare?.exports) {
    nitro.logger.warn(
      `Your custom Cloudflare entrypoint \`${prettyPath(nitro.options.cloudflare.exports)}\` file does not exist.`
    );
  } else if (entry && !nitro.options.cloudflare?.exports) {
    nitro.logger.info(
      `Detected \`${prettyPath(entry)}\` as Cloudflare entrypoint.`
    );
  }

  return entry;
}

async function resolveModuleExportNames(path: string) {
  const content = await readFile(path, "utf8");
  const parsed = parseSync(path, content, { sourceType: "module" });
  const exports = parsed.module.staticExports
    .flatMap((exp) => exp.entries.map((e) => e.exportName))
    .filter((e) => e.kind === "Default" || e.kind === "Name");

  return exports.map((e) => e.name ?? "default");
}
