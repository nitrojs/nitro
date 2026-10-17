import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  resolve: { alias: { "~vite-alias": import.meta.dirname } },
  plugins: [nitro()],
});
