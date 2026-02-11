import { defineNitroPreset } from "../_utils/preset.ts";
import { builtinModules } from "node:module";
import { rm } from "node:fs/promises";

const edgeScripting = defineNitroPreset(
  {
    entry: "./bunny/runtime/edge-scripting.ts",

    exportConditions: ["deno"],
    commands: {
      preview: "deno -A ./bunny-edge-scripting.mjs",
    },

    output: {
      dir: "{{ rootDir }}/.output",
      serverDir: "{{ output.dir }}",
      publicDir: "{{ output.dir }}/public",
    },

    rollupConfig: {
      output: {
        format: "esm",
        entryFileNames: "bunny-edge-scripting.mjs",
        inlineDynamicImports: true,
        hoistTransitiveImports: false,
      },
      external: (id: string) =>
        id.startsWith("https://") || id.startsWith("node:") || builtinModules.includes(id),
    },

    serveStatic: "inline",
    minify: true,

    hooks: {
      async compiled(nitro) {
        const publicDir = nitro.options.output.publicDir;
        // remove the public dir and all its files, as they are inlined in the server bundle
        await rm(publicDir, { recursive: true, force: true });
      },
    },
  },
  {
    aliases: ["bunny"],
    name: "bunny-edge-scripting" as const,
  }
);

export default [edgeScripting] as const;
