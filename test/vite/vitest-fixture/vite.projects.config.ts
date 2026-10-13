import { nitro } from "nitro/vite";
import { defineConfig } from "vitest/config";

// Inline projects resolve from the raw `test` config, before Nitro's defaults apply
export default defineConfig({
  cacheDir: "./node_modules/.vite",
  plugins: [nitro({ serverDir: "./", runtimeConfig: { greeting: "hello" } })],
  test: { projects: [{ extends: true, test: { name: "server", environment: "nitro" } }] },
});
