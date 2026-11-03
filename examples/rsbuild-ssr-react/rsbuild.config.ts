import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { nitro } from "nitro/rsbuild";

export default defineConfig({
  source: {
    entry: { index: "./src/entry-client.tsx" },
  },
  // Pages are rendered by the server entry
  tools: { htmlPlugin: false },
  plugins: [pluginReact(), nitro({ serverDir: "./" })],
});
