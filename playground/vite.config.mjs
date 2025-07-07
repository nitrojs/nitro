import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  appType: 'spa',
  build: {
    rollupOptions: {
      input: {
        index: './index.html',
      }
    }
  },
  plugins: [
    nitro({
      config: { compatibilityDate: "latest" },
      services: {
        simple: { entry: "./apps/simple", path: "/simple" },
      },
    }),
  ],
});
