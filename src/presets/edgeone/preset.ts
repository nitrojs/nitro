import { defineNitroPreset } from "../_utils/preset.ts";
import { writeEdgeOneRoutes } from "./utils.ts";
import type { Nitro } from "nitro/types";

const edgeone = defineNitroPreset(
  {
    entry: "./edgeone/runtime/edgeone",
    extends: "node-server",
    serveStatic: true,
    output: {
      dir: "{{ rootDir }}/.edgeone",
      serverDir: "{{ output.dir }}/server-handler",
      publicDir: "{{ output.dir }}/assets",
    },
    rollupConfig: {
      output: {
        entryFileNames: "handler.js",
      },
    },
    hooks: {
      async compiled(nitro: Nitro) {
        await writeEdgeOneRoutes(nitro);
      },
    },
  },
  {
    name: "edgeone-pages" as const,
  }
);

export default [edgeone] as const;
