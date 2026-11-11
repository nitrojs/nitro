import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./",
  runtimeConfig: { greeting: "hello" },
  routeRules: {
    "/rules/headers": { headers: { "x-rule": "1" } },
    "/rules/redirect": { redirect: "/" },
  },
});
