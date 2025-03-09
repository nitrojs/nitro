import { defineNitroPreset } from "../_utils/preset";
import type { Nitro } from "nitro/types";
import { writeSWARoutes } from "./utils";

export type { AzureOptions as PresetOptions } from "./types";

const azure = defineNitroPreset(
  {
    entry: "./runtime/azure-swa",
    output: {
      serverDir: "{{ output.dir }}/server/functions",
      publicDir: "{{ output.dir }}/public/{{ baseURL }}",
    },
    commands: {
      preview:
        "npx @azure/static-web-apps-cli start ./public --api-location ./server",
    },
    hooks: {
      async compiled(ctx: Nitro) {
        await writeSWARoutes(ctx);
      },
    },
  },
  {
    name: "azure-swa" as const,
    aliases: ["azure"] as const,
    stdName: "azure_static",
    url: import.meta.url,
  }
);

export default [azure] as const;
