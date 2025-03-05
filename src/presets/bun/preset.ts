import { defineNitroPreset } from "nitro/kit";

const bun = defineNitroPreset(
  {
    extends: "node-server",
    entry: "./runtime/bun",
    // https://bun.sh/docs/runtime/modules#resolution
    exportConditions: ["bun", "worker", "node", "import", "default"],
    commands: {
      preview: "bun run ./server/index.mjs",
    },
  },
  {
    name: "bun" as const,
    url: import.meta.url,
  }
);

export default [bun] as const;
