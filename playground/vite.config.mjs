import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  environments: {
    client: {
      consumer: "client",
      build: {
        rollupOptions: {
          input: "index.html",
        },
      },
    },
    ssr: {
      consumer: "server",
      build: {
        rollupOptions: {
          input: "ssr.ts",
        },
      },
    },
  },
  plugins: [nitro()],
});
