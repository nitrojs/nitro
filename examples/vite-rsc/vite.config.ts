import rsc from "@vitejs/plugin-rsc";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    nitro({
      experimental: {
        vite: {
          services: {
            ssr: {
              entry: "./src/framework/entry.ssr.tsx",
            },
            rsc: {
              entry: "./src/framework/entry.rsc.tsx",
            },
          },
        },
      },
    }),
    rsc({
      serverHandler: false,
    }),
    react(),
  ],

  environments: {
    client: {
      build: {
        rollupOptions: {
          input: {
            index: "./src/framework/entry.browser.tsx",
          },
        },
      },
    },
  },
});
