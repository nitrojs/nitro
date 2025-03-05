import { defineNitroPreset } from "nitro/kit";

const stormkit = defineNitroPreset(
  {
    entry: "./runtime/stormkit",
    output: {
      dir: "{{ rootDir }}/.stormkit",
      publicDir: "{{ rootDir }}/.stormkit/public/{{ baseURL }}",
    },
  },
  {
    name: "stormkit" as const,
    stdName: "stormkit",
    url: import.meta.url,
  }
);

export default [stormkit] as const;
