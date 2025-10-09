import { defineNitroPreset } from "../_utils/preset";

const stormkit = defineNitroPreset(
  {
    entry: "./stormkit/runtime/stormkit",
    output: {
      dir: "{{ rootDir }}/.stormkit",
      publicDir: "{{ rootDir }}/.stormkit/public/{{ baseURL }}",
    },
  },
  {
    name: "stormkit" as const,
    stdName: "stormkit",
  }
);

export default [stormkit] as const;
