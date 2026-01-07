import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

import rsc from "@vitejs/plugin-rsc";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    nitro({
      experimental: {
        vite: {
          services: {
            ssr: { entry: "./app/framework/entry.ssr.tsx" },
            rsc: { entry: "./app/framework/entry.rsc.tsx" },
          },
        },
      },
    }),
    rsc({ serverHandler: false }),
    react(),
  ],

  environments: {
    client: {
      build: {
        rollupOptions: {
          input: { index: "./app/framework/entry.browser.tsx" },
        },
      },
    },
  },
});
