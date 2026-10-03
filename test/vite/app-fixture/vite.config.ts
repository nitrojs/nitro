import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    nitro({
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
      ],
    }),
  ],
});
