import { builtinModules } from "node:module";
import { defineNitroPreset } from "../_utils/preset.ts";
import type { Nitro, RollupConfig } from "nitro/types";

const NODE_BUILTINS = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

const winterjs = defineNitroPreset(
  {
    extends: "base-worker",
    entry: "./winterjs/runtime/winterjs",
    serveStatic: "inline",
    wasm: {
      lazy: true,
    },
    hooks: {
      "rollup:before": (_nitro: Nitro, config: RollupConfig) => {
        // WinterJS cannot parse `import.meta`. The entry banner injected by
        // `nitro:server-main` is only read back by the Node.js public asset
        // reader, which this preset never uses (`serveStatic: "inline"`).
        config.plugins = (config.plugins as { name?: string }[]).filter(
          (plugin) => plugin?.name !== "nitro:server-main"
        ) as RollupConfig["plugins"];

        // WinterJS has no `node:*` modules, so they must resolve to their unenv
        // aliases. Left external, an IIFE bundle turns them into undefined globals.
        if (Array.isArray(config.external)) {
          config.external = config.external.filter(
            (id) => typeof id !== "string" || !NODE_BUILTINS.has(id)
          );
        }
      },
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
