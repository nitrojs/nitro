import { defineNitroPreset } from "../_utils/preset.ts";
import { writeEdgeOneConfig } from "./utils.ts";
import type { Nitro } from "nitro/types";

const edgeone = defineNitroPreset(
  {
    extends: "node-server",
    entry: "./edgeone/runtime/edgeone",
    serveStatic: false, // EdgeOne serves static assets from `.edgeone/assets/`
    output: {
      dir: "{{ rootDir }}/.edgeone",
      serverDir: "{{ output.dir }}/cloud-functions/ssr-node",
      publicDir: "{{ output.dir }}/assets/{{ baseURL }}",
    },
    rollupConfig: {
      output: {
        entryFileNames: "handler.js",
      },
    },
    hooks: {
      async compiled(nitro: Nitro) {
        await writeEdgeOneConfig(nitro);
      },
    },
  },
  {
    name: "edgeone-pages" as const,
    aliases: ["edgeone"] as const,
  }
);

export default [edgeone] as const;
