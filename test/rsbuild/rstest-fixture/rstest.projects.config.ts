import { defineConfig } from "@rstest/core";
import { nitro } from "nitro/rsbuild";

export default defineConfig({
  projects: [
    {
      name: "server",
      include: ["tests/**/*.spec.ts"],
      exclude: ["tests/no-app.spec.ts"],
      plugins: [nitro({ serverDir: "./", runtimeConfig: { greeting: "hello" } })],
    },
    { name: "other", include: ["tests/no-app.spec.ts"] },
  ],
});
