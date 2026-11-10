import { defineConfig } from "nitro";

export default defineConfig({
  preset: "static",
  prerender: { crawlLinks: false, routes: ["/"] },
  runtimeConfig: { target: "default" },
  commands: {
    deploy: (nitro) => {
      (globalThis as any).__nitroDeployEnvName = nitro.options.envName;
    },
  },
  $env: {
    staging: { runtimeConfig: { target: "staging" } },
  },
});
