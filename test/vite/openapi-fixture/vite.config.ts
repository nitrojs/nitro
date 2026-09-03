import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    nitro({
      serverDir: "./",
      experimental: { openAPI: true },
      openAPI: {
        meta: {
          title: "OpenAPI Test API",
          description: "OpenAPI Test Description",
        },
      },
    }),
  ],
});
