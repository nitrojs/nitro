import { defineNitroConfig } from "nitropack/config";

export default defineNitroConfig({
  compatibilityDate: "2025-01-30",
  cloudflare: {
    wrangler: {
      compatibility_flags: ["nodejs_als"],
    },
  },
});
