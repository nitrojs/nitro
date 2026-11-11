import { defineNitroPreset } from "../_utils/preset.ts";
import { compileScriptc } from "./_compile.ts";
import { scriptcPlugin } from "./plugin.ts";

export type { ScriptcOptions as PresetOptions } from "./types.ts";

const scriptc = defineNitroPreset(
  {
    entry: "./scriptc/runtime/scriptc",
    // Embedded in the binary, so it can be moved (`import.meta.url` is fixed at compile time)
    serveStatic: "inline",
    minify: false,
    noExternals: true,
    exportConditions: ["scriptc"],
    features: {
      fastResponse: false,
    },
    buildPlugins: [scriptcPlugin()],
    hooks: {
      async compiled(nitro) {
        if (nitro.options.scriptc?.compile !== false) {
          await compileScriptc(nitro);
        }
      },
    },
  },
  {
    name: "scriptc" as const,
  }
);

export default [scriptc] as const;
