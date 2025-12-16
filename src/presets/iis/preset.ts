import { defineNitroPreset } from "../_utils/preset.ts";
import type { Nitro } from "nitro/types";
import { writeIISFiles, writeIISNodeFiles } from "./utils.ts";

const iisHandler = defineNitroPreset(
  {
    extends: "node-server",
    serveStatic: true,
    hooks: {
      async compiled(nitro: Nitro) {
        await writeIISFiles(nitro);
      },
    },
  },
  {
    name: "iis-handler" as const,
  }
);

const iisNode = defineNitroPreset(
  {
    extends: "node-server",
    serveStatic: true,
    hooks: {
      async compiled(nitro: Nitro) {
        await writeIISNodeFiles(nitro);
      },
    },
  },
  {
    name: "iis-node" as const,
  }
);

export default [iisHandler, iisNode] as const;
