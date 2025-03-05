import { defineNitroPreset } from "nitro/kit";

const nitroPrerender = defineNitroPreset(
  {
    extends: "node",
    serveStatic: true,
    entry: "./runtime/nitro-prerenderer",
    output: {
      serverDir: "{{ buildDir }}/prerender",
    },
    externals: { trace: false },
  },
  {
    name: "nitro-prerender" as const,
    url: import.meta.url,
  }
);

export default [nitroPrerender] as const;
