import { defineNitroConfig } from "nitropack/config";

export default defineNitroConfig({
  compatibilityDate: "2024-09-19",
  cloudflare: {
    wrangler: {
      compatibility_flags: ["nodejs_als"],
    },
  },
});
