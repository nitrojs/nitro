import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

import vue from "@vitejs/plugin-vue";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    vue(),
    react(),
    nitro({
      services: {
        // SSR
        ssr: { entry: "./services/default.ts" },
        vue: { entry: "./services/vue/server.ts", baseURL: "/vue" },
        react: { entry: "./services/react/server.tsx", baseURL: "/react" },
        // API
        fetch: { entry: "./services/fetch.ts", baseURL: "/api/fetch" },
        h3: { entry: "./services/h3.ts", baseURL: "/api/h3" },
        hono: { entry: "./services/hono.ts", baseURL: "/api/hono" },
        node: { entry: "./services/node.ts", baseURL: "/api/node" },
      },
    }),
  ],
  environments: {
    // Client
    client: {
      consumer: "client",
      build: {
        rollupOptions: {
          input: ["./services/vue/client.ts", "./services/react/client.tsx"],
        },
      },
    },
  },
});
