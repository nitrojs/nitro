import { defineNitroPreset } from "../_utils/preset.ts";

const standard = defineNitroPreset(
  {
    entry: "./standard/runtime/server",
    serveStatic: false,
    output: {
      publicDir: "{{ output.dir }}/public/{{ baseURL }}",
    },
    commands: {
      preview: "npx srvx --prod ./",
    },
    alias: {
      srvx: "srvx/generic",
      "srvx/bun": "srvx/bun",
      "srvx/deno": "srvx/deno",
      "srvx/node": "srvx/node",
      "srvx/generic": "srvx/generic",
      "srvx/tracing": "srvx/tracing",
    },
  },
  {
    name: "standard" as const,
  }
);

export default [standard] as const;
