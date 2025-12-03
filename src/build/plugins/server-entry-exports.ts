import type { Nitro } from "nitro/types";
import type { Plugin } from "rollup";

/**
 * Create a Rollup plugin that appends a re-export of the internal server entry to the configured server entry file.
 *
 * When `nitro.options.serverEntry` is enabled, the plugin targets the file at `nitro.options.entry + ".mjs"` and appends
 * `export * from "#nitro-internal-virtual/server-entry";` to its contents before bundling.
 *
 * @param nitro - Nitro runtime/configuration used to determine the entry path and whether the re-export should be applied
 * @returns A Rollup `Plugin` which transforms the matching server entry module by appending the internal server-entry re-export
 */
export function serverEntryExports(nitro: Nitro): Plugin {
  return {
    name: "nitro:server-entry-exports",
    transform(code, id) {
      // Only append if serverEntry is defined
      if (!nitro.options.serverEntry) {
        return null;
      }

      // Only process the preset entry file (need to add .mjs extension)
      const entryWithExt = nitro.options.entry + ".mjs";
      if (id !== entryWithExt) {
        return null;
      }

      // Append re-export statement before code is bundled
      const reExport = `\nexport * from "#nitro-internal-virtual/server-entry";\n`;

      return {
        code: code + reExport,
        map: null,
      };
    },
  };
}
