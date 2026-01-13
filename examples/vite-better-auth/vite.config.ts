import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nitro({
      serverDir: "./server",
      routes: {
        "/api/auth/**": "./auth.ts",
      },
    }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  environments: {
    ssr: {
      build: { rollupOptions: { input: "./app/entry/server.tsx" } },
    },
    client: {
      build: { rollupOptions: { input: "./app/entry/client.tsx" } },
    },
  },
});
