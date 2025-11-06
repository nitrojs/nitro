import { defineNitroPreset } from "../_utils/preset.ts";

const standard = defineNitroPreset(
  {
    entry: "./standard/runtime/server",
    serveStatic: false,
    exportConditions: ["import", "default"],
    output: {
      publicDir: "{{ output.dir }}/public/{{ baseURL }}",
    },
    commands: {
      preview: "npx srvx --prod ./",
    },
    alias: {
      srvx: "srvx/generic",
      "srvx/": "srvx/",
    },
  },
  {
    name: "standard" as const,
  }
);

export default [standard] as const;
