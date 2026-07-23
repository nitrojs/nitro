import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    nitro({
      preset: "cloudflare-module",
      serverDir: "./",
      cloudflare: {
        wrangler: {
          durable_objects: {
            bindings: [{ name: "COUNTER", class_name: "CounterDO" }],
          },
          workflows: [
            { binding: "ECHO_WORKFLOW", name: "echo-workflow", class_name: "EchoWorkflow" },
          ],
        },
      },
    }),
  ],
});
