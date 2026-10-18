import { defineNitroPreset } from "../_utils/preset.ts";
import { writeFile } from "../_utils/fs.ts";
import { resolve } from "pathe";
import { builtinModules } from "node:module";

const denoServer = defineNitroPreset(
  {
    entry: "./deno/runtime/deno-server",
    serveStatic: true,
    exportConditions: ["deno"],
    commands: {
      preview: "deno -A ./server/index.mjs",
    },
    rollupConfig: {
      external: (id) =>
        id.startsWith("https://") || id.startsWith("node:") || builtinModules.includes(id),
      output: {
        hoistTransitiveImports: false,
      },
    },
    hooks: {
      async compiled(nitro) {
        // https://docs.deno.com/runtime/fundamentals/configuration/
        const denoJSON = {
          tasks: {
            start: "deno run -A ./server/index.mjs",
          },
        };
        await writeFile(
          resolve(nitro.options.output.dir, "deno.json"),
          JSON.stringify(denoJSON, null, 2)
        );
      },
    },
  },
  {
    // `deno-deploy` also matches std-env provider detection on Deno Deploy
    aliases: ["deno", "deno-deploy"],
    name: "deno-server" as const,
  }
);

export default [denoServer] as const;
