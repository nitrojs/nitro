import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./",
  // Keeps the Nitro `baseURL` apart from the Vite `base`
  baseURL: "/",
});
