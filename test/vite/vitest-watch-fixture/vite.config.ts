import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // Separate from the deps cache of the Vite servers other tests run concurrently
  cacheDir: "./node_modules/.vite",
  plugins: [nitro({ serverDir: "./" })],
});
