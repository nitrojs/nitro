import { defineConfig } from "nitro";

export default defineConfig({
  builder: false,
  serverDir: "./",
  alias: {
    "~lib": "./lib",
  },
  experimental: {
    asyncContext: true,
  },
});
