import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [react(), nitro()],
  environments: {
    client: {
      build: { rollupOptions: { input: "./app/client.tsx" } },
      consumer: "client",
    },
  },
});
