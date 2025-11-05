import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    nitro({
      // Enable .env loading in production builds
      dotenv: true,
    }),
    tailwindcss(),
  ],
  nitro: {
    // serverDir: "server",
    routes: {
      "/quote": { handler: "./server/routes/quote.ts" },
      "/api/env-test": { handler: "./server/routes/api/env-test.ts" },
    },
    runtimeConfig: {
      // These values will be overridden by NITRO_* env vars from .env
      apiKey: "",
      appName: "",
    },
  },
});
