import { defineNitroPreset } from "nitropack/kit";
import { writeFile } from "nitropack/kit";
import { resolve } from "pathe";
import { unenvDenoPreset } from "../_unenv/preset-deno";

import { denoServerLegacy } from "./preset-legacy";

const denoDeploy = defineNitroPreset(
  {
    entry: "./runtime/deno-deploy",
    exportConditions: ["deno"],
    node: false,
    noExternals: true,
    serveStatic: "deno",
    commands: {
      preview: "",
      deploy:
        "cd ./ && deployctl deploy --project=<project_name> {{ output.serverDir }}/index.ts",
    },
    unenv: unenvDenoPreset,
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
    aliases: ["deno"] as const,
    url: import.meta.url,
  }
);

const denoServer = defineNitroPreset(
  {
    extends: "node-server",
    entry: "./runtime/deno-server",
    exportConditions: ["deno"],
    commands: {
      preview: "deno task --config ./deno.json start",
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
            start:
              "deno run --allow-net --allow-read --allow-write --allow-env --unstable-byonm --unstable-node-globals ./server/index.mjs",
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
    name: "deno-server" as const,
    compatibilityDate: "2025-01-30",
    url: import.meta.url,
  }
);

export default [denoServerLegacy, denoDeploy, denoServer] as const;
