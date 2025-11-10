import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

// https://vite-devtools.netlify.app/guide/
import { DevTools } from "@vitejs/devtools";

export default defineConfig({
  plugins: [DevTools(), nitro()],
  build: {
    rolldownOptions: {
      debug: {}, // enable debug mode
    },
  },
});
