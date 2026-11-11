import { defineNitroPreset } from "../_utils/preset.ts";
import { compileScriptc } from "./_compile.ts";
import { scriptcPlugin } from "./plugin.ts";

export type { ScriptcOptions as PresetOptions } from "./types.ts";

const scriptc = defineNitroPreset(
  {
    entry: "./scriptc/runtime/scriptc",
    serveStatic: true,
    minify: false,
    noExternals: true,
    exportConditions: ["scriptc"],
    features: {
      fastResponse: false,
    },
    buildPlugins: [scriptcPlugin()],
    commands: {
      preview: "./server/index",
    },
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
