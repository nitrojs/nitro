import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: ".",
  experimental: {
    tasks: true,
  },
  vercel: {
    queues: {
      triggers: [{ topic: "notifications" }],
    },
  },
});
