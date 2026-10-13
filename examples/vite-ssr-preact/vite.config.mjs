import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [nitro(), preact()],
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: "./src/entry-client.tsx",
        },
      },
    },
  },
});
