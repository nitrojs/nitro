import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    nitro({
      config: { compatibilityDate: "latest" },
      services: {
        simple: { entry: "./apps/simple", path: "/simple" },
      },
    }),
  ],
});
