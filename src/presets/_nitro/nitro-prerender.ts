import { defineNitroPreset } from "../_utils/preset";

const nitroPrerender = defineNitroPreset(
  {
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
