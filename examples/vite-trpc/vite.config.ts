import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    nitro({
      routes: {
        "/trpc/**": "./server/trpc.ts",
      },
    }),
  ],
});
