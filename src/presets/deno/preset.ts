import { defineNitroPreset } from "../_utils/preset.ts";
import { writeFile } from "../_utils/fs.ts";
import { resolve } from "pathe";
import { unenvDeno } from "./unenv/preset.ts";
import { builtinModules } from "node:module";

const denoDeploy = defineNitroPreset(
  {
    entry: "./deno/runtime/deno-deploy",
    manifest: {
      // https://docs.deno.com/deploy/reference/env_vars_and_contexts/#predefined-environment-variables
      // https://docs.deno.com/deploy/classic/environment-variables/#default-environment-variables
      deploymentId: process.env.DENO_DEPLOYMENT_ID,
    },
    exportConditions: ["deno"],
    node: false,
    serveStatic: "deno",
    commands: {
      preview: "",
      deploy: "cd ./ && deno run -A jsr:@deno/deployctl deploy server/index.ts",
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
    aliases: ["deno"],
    name: "deno-server" as const,
  }
);

export default [denoDeploy, denoServer] as const;
