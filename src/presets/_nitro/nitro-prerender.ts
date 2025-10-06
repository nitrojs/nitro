import { defineNitroPreset } from "../_utils/preset";

const nitroPrerender = defineNitroPreset(
  {
    entry: "./_nitro/runtime/nitro-prerenderer",
    serveStatic: true,
    output: {
      serverDir: "{{ buildDir }}/prerender",
    },
    externals: { noTrace: true },
  },
  {
    name: "nitro-prerender" as const,
  }
);

export default [nitroPrerender] as const;
