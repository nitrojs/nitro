import { defineConfig } from "nitro";

export default defineConfig({
  preset: "static",
  prerender: { crawlLinks: false, routes: ["/"] },
  runtimeConfig: { target: "default" },
  $env: {
    staging: { runtimeConfig: { target: "staging" } },
  },
});
