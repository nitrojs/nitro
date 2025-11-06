import { defineConfig } from "nitro";

export default defineConfig({
  routes: {
    "/**": { handler: "./server.ts", format: "node" },
  },
  vercel: {
    functions: {
      runtime: "bun1.x",
    },
  },
});
