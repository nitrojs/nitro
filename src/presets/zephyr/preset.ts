import { defineNitroPreset } from "../_utils/preset.ts";
import { createUploadRunner } from "./utils.ts";
import type { Nitro } from "nitro/types";

const zephyr = defineNitroPreset(
  {
    extends: "standard",
    entry: "./standard/runtime/server",
    serveStatic: "inline",
    hooks: {
      "build:before"() {
        // TODO: Determine preset here....
      },
      compiled: async (nitro: Nitro) => {
        const startTime = Date.now();
        const { ZephyrEngine } = await import("zephyr-agent");
        const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
        let initialized = false;

        const initEngine = () => {
          if (initialized) return;
          initialized = true;
          zephyr_defer_create({
            builder: "unknown",
            context: nitro.options.rootDir,
          });
        };

        const runUpload = createUploadRunner({
          nitro,
          zephyrEngineDefer: zephyr_engine_defer,
          initEngine,
        });

        await runUpload();

        const endTime = Date.now();
        console.log(`Zephyr deploy completed in ${(endTime - startTime) / 1000}s`);
      },
    },
  },
  {
    name: "zephyr" as const,
  }
);

export default [zephyr] as const;
