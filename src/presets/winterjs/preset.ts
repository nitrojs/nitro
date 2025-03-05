import { defineNitroPreset } from "nitro/kit";

const winterjs = defineNitroPreset(
  {
    extends: "base-worker",
    entry: "./runtime/winterjs",
    minify: false,
    serveStatic: "inline",
    wasm: {
      lazy: true,
    },
    commands: {
      preview:
        "wasmer run wasmer/winterjs --forward-host-env --net --mapdir app:./ app/server/index.mjs",
    },
  },
  {
    name: "winterjs" as const,
    url: import.meta.url,
  }
);

export default [winterjs] as const;
