import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  compatibilityDate: "latest",
  srcDir: "server",
  experimental: {
    openAPI: true,
  },
  openAPI: {
    production: "runtime",
  },
});
