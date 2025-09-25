import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  compatibilityDate: "latest",
  routeRules: {
    "/**": { headers: { "X-Powered-By": "Nitro" } },
  },
});
