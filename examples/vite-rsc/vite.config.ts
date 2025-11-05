import rsc from "@vitejs/plugin-rsc";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    rsc({
      // serverHandler: false,
      loadModuleDevRunner: "globalThis.__nitro_vite_envs__.rsc.runner",
    }),
    react(),
    nitro({
      services: {
        ssr: { entry: "./src/framework/entry.ssr.tsx" },
        rsc: { entry: "./src/framework/entry.rsc.tsx" },
      },
    }),
  ],
  environments: {
    rsc: {
      build: {
        rollupOptions: {
          input: { index: "./src/framework/entry.rsc.tsx" },
        },
      },
    },
    ssr: {
      build: {
        rollupOptions: {
          input: { index: "./src/framework/entry.ssr.tsx" },
        },
      },
    },
    client: {
      build: {
        rollupOptions: {
          input: { index: "./src/framework/entry.browser.tsx" },
        },
      },
    },
  },
});
