import { defineNitroPreset } from "../_utils/preset.ts";
import type { Nitro } from "nitro/types";
import { setupAzureFunctions, writeFunctionFiles } from "./_functions.ts";
import { writeSWARoutes } from "./utils.ts";

export type { AzureOptions as PresetOptions } from "./types.ts";

const azureSWA = defineNitroPreset(
  {
    entry: "./azure/runtime/azure-swa.{version}",
    output: {
      serverDir: "{{ output.dir }}/server/functions",
      publicDir: "{{ output.dir }}/public/{{ baseURL }}",
    },
    commands: {
      preview: "npx @azure/static-web-apps-cli start ./public --api-location ./server",
    },
    hooks: {
      async "build:before"(nitro: Nitro) {
        await setupAzureFunctions(nitro);
      },
      async compiled(ctx: Nitro) {
        await writeSWARoutes(ctx);
        await writeFunctionFiles(ctx);
      },
    },
  },
  {
    name: "azure-swa" as const,
    stdName: "azure_static",
  }
);

export default [azureSWA] as const;
