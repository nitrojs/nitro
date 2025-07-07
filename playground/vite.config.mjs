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
        api: { entry: "./services/api.ts" },
        h3: { entry: "./services/h3.ts" },
        hono: { entry: "./services/hono.ts" },
        vue: { entry: "./services/vue/server.ts" },
        react: { entry: "./services/react/server.tsx" },
      },
    }),
  ],
});
