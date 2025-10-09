import { defineNitroPreset } from "../_utils/preset";

const winterjs = defineNitroPreset(
  {
    extends: "base-worker",
    entry: "./winterjs/runtime/winterjs",
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
  }
);

export default [winterjs] as const;
