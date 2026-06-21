import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tanstackStart(), viteReact(), tailwindcss(), nitro()],
  resolve: { tsconfigPaths: true },
  environments: {
    ssr: { build: { rollupOptions: { input: "./server.ts" } } },
  },
});
