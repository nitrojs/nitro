import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    nitro({
      config: { compatibilityDate: "latest" },
      services: {
        simple: "./services/simple",
      },
    }),
  ],
});
