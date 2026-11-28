import { defineConfig } from "@rstest/core";
import { nitro } from "nitro/rsbuild";

export default defineConfig({
  include: ["tests/**/*.spec.ts"],
  plugins: [
    nitro({
      serverDir: "./",
      runtimeConfig: { greeting: "hello" },
      rspackConfig: { module: { rules: [{ test: /\.txt$/, type: "asset/source" }] } },
    }),
  ],
});
