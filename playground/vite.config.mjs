import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

import vue from "@vitejs/plugin-vue";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    vue(),
    react(),
    nitro({
      config: { compatibilityDate: "latest" },
      services: {
        // API Services
        fetch: { entry: "./services/fetch.ts" },
        h3: { entry: "./services/h3.ts" },
        hono: { entry: "./services/hono.ts" },
        node: { entry: "./services/node.ts" },
        // SSR Services
        vue: { entry: "./services/vue/server.ts" },
        react: { entry: "./services/react/server.tsx" },
      },
    }),
  ],
  environments: {
    vueClient: {
      consumer: "client",
      build: { rollupOptions: { input: "./services/vue/client.ts" } },
    },
    reactClient: {
      consumer: "client",
      build: { rollupOptions: { input: "./services/react/client.tsx" } },
    },
  },
});
