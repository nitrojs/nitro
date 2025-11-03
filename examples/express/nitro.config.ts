import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  routes: {
    "/**": { handler: "./server", format: "node" },
  },
});
