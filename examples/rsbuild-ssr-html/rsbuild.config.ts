import { defineConfig } from "@rsbuild/core";
import { nitro } from "nitro/rsbuild";

export default defineConfig({
  source: {
    entry: { index: "./app/entry-client.ts" },
  },
  html: {
    template: "./index.html",
  },
  plugins: [nitro({ serverDir: "./" })],
});
