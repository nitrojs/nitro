import { defineConfig } from "nitro";
import type { NitroBuildPlugin } from "nitro/types";

export default defineConfig({
  builder: false,
  serverDir: "./",
  buildPlugins: [
    {
      name: "fixture:virtual",
      resolveId: {
        filter: { id: /^virtual:build-plugin$/ },
        handler: (id) => `\0${id}`,
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
          handler: (code) => code.replace("__BUILD_PLUGIN_TRANSFORM__", "transformed"),
        },
      },
    ],
    Promise.resolve(virtualModule("virtual:promise", "promise")),
    [[Promise.resolve(virtualModule("virtual:nested-promise", "nested-promise"))]],
  ],
  alias: {
    "~lib": "./lib",
  },
  experimental: {
    asyncContext: true,
  },
});

function virtualModule(id: string, value: string): NitroBuildPlugin {
  return {
    name: `fixture:${value}`,
    resolveId: { filter: { id: new RegExp(`^${id}$`) }, handler: () => `\0${id}` },
    load: {
      filter: { id: new RegExp(`^\0${id}$`) },
      handler: () => `export default ${JSON.stringify(value)}`,
    },
  };
}
