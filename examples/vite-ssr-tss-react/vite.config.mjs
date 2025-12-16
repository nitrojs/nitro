import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
    nitro(),
  ],
  environments: {
    ssr: { build: { rollupOptions: { input: "./server.ts" } } },
  },
});
