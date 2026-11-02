import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  environments: {
    ssr: {
      build: {
        rollupOptions: {
          input: "./entry-server.ts",
          output: { entryFileNames: "[name]-[hash].mjs" },
        },
      },
    },
  },
  plugins: [nitro({ preset: "standard", serverDir: "./" })],
});
