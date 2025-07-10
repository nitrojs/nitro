import { join } from "node:path";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

import vue from "@vitejs/plugin-vue";
import react from "@vitejs/plugin-react";

const dispatchHandler = join(import.meta.dirname, "./dispatch.ts");

export default defineConfig({
  plugins: [
    vue(),
    react(),
    nitro({
      config: {
        handlers: [
          { route: "/", handler: dispatchHandler },
          { route: "/:service", handler: dispatchHandler },
        ],
      },
      services: {
        landing: { entry: "./apps/landing.ts" },
        // API
        fetch: { entry: "./apps/fetch.ts" },
        h3: { entry: "./apps/h3.ts" },
        hono: { entry: "./apps/hono.ts" },
        node: { entry: "./apps/node.ts" },
        // SSR
        vue: { entry: "./apps/vue/server.ts" },
        react: { entry: "./apps/react/server.tsx" },
      },
    }),
  ],
  environments: {
    // Client environments
    vueClient: {
      consumer: "client",
      build: { rollupOptions: { input: "./apps/vue/client.ts" } },
    },
    reactClient: {
      consumer: "client",
      build: { rollupOptions: { input: "./apps/react/client.tsx" } },
    },
  },
});
