import { defineNitroPreset } from "../_utils/preset";

const nitroPrerender = defineNitroPreset(
  {
    entry: "./runtime/nitro-prerenderer",
    serveStatic: true,
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
