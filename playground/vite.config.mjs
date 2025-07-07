import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [
    vue(),
    nitro({
      config: { compatibilityDate: "latest" },
      services: {
        api: { entry: "./services/api.ts" },
        h3: { entry: "./services/h3.ts" },
        hono: { entry: "./services/hono.ts" },
        // Vue with server-side rendering
        vue: { entry: "./services/vue/server.ts" },
      },
    }),
  ],
});
