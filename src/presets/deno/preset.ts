import { builtinModules } from "node:module";
import { defineNitroPreset } from "nitropack/kit";
import { writeFile } from "nitropack/kit";
import { resolve } from "pathe";

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
        "cd ./ && deployctl deploy --project=<project_name> server/index.ts",
    },
    rollupConfig: {
      preserveEntrySignatures: false,
      external: (id) => id.startsWith("https://"),
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
      preview: "deno task start",
    },
    rollupConfig: {
      external: (id) =>
        id.startsWith("https://") ||
        id.startsWith("node:") ||
        builtinModules.includes(id),
      output: {
        hoistTransitiveImports: false,
      },
    },
    alias: {
      // Deno supports `fetch()` natively everywhere
      "node-fetch-native": "unenv/runtime/mock/empty",
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
    url: import.meta.url,
  }
);

export default [denoDeploy, denoServer] as const;
