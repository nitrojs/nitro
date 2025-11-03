import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [nitro(), tailwindcss()],
  nitro: {
    // serverDir: "server",
    routes: {
      "/quote": { handler: "./server/routes/quote.ts" },
    },
  },
});
