import { defineNitroPreset } from "../_utils/preset";

const bun = defineNitroPreset(
  {
    entry: "./runtime/bun",
    serveStatic: true,
    // https://bun.sh/docs/runtime/modules#resolution
    exportConditions: ["bun", "node", "import", "default"],
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
