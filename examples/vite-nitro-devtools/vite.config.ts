import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
// https://deploy-preview-127--vite-devtools.netlify.app/guide/
import { DevTools } from "@vitejs/devtools";

export default defineConfig({
  plugins: [DevTools(), nitro()],
  nitro: { serverDir: "./" },
  build: {
    rolldownOptions: {
      debug: {}, // enable debug mode
    },
  },
});
