import { defineConfig } from "nitro";

export default defineConfig({
  builder: false,
  serverDir: "./",
  buildPlugins: [
    {
      name: "fixture:virtual",
      resolveId: {
        filter: { id: /^virtual:build-plugin$/ },
        handler: (id: string) => `\0${id}`,
      },
      load: {
        filter: { id: /^\0virtual:build-plugin$/ },
        handler: () => `export default "Hello from build plugin!"`,
      },
    },
    [
      {
        name: "fixture:transform",
        enforce: "pre",
        transform: {
          filter: { id: /build-plugins\.ts$/ },
          handler: (code: string) => code.replace("__BUILD_PLUGIN_TRANSFORM__", "transformed"),
        },
      },
    ],
  ],
  alias: {
    "~lib": "./lib",
  },
  experimental: {
    asyncContext: true,
  },
});
