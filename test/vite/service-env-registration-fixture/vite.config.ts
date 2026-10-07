import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    nitro(),
    {
      // A slow `options` hook keeps the ssr environment's `init()` pending (the test controls how long).
      name: "slow-ssr-init",
      async options() {
        if (this.environment.name === "ssr") {
          await (globalThis as any).__slowSsrInit?.();
        }
      },
    },
  ],
});
