import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./server",

  rolldownConfig: {
    output: {},
    treeshake: {
      // https://github.com/nitrojs/nitro/issues/4085
      moduleSideEffects: true,
    },
  },
});
