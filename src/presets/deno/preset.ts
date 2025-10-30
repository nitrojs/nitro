import { defineNitroPreset } from "../_utils/preset.ts";
import { writeFile } from "../_utils/fs.ts";
import { resolve } from "pathe";
import { unenvDeno } from "./unenv/preset.ts";

const denoDeploy = defineNitroPreset(
  {
    entry: "./deno/runtime/deno-deploy",
    exportConditions: ["deno"],
    node: false,
    noExternals: true,
    serveStatic: "deno",
    commands: {
      preview: "",
      deploy:
        "cd ./ && deployctl deploy --project=<project_name> server/index.ts",
    },
    unenv: unenvDeno,
    rollupConfig: {
      preserveEntrySignatures: false,
      external: (id) => id.startsWith("https://") || id.startsWith("node:"),
      output: {
        entryFileNames: "index.ts",
        manualChunks: (id) => "index",
        format: "esm",
      },
    },
  },
  {
    name: "deno-deploy" as const,
  }
);

const denoServer = defineNitroPreset(
  {
    entry: "./deno/runtime/deno-server",
    serveStatic: true,
    exportConditions: ["deno"],
    commands: {
      preview: "deno -A ./server/index.mjs",
    },
    rollupConfig: {
      external: (id) => id.startsWith("https://"),
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
    aliases: ["deno"],
    name: "deno-server" as const,
  }
);

export default [denoDeploy, denoServer] as const;
