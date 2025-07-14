import { defineNitroPreset } from "nitropack/kit";
import type { Nitro } from "nitropack/types";
import { writeFunctionsRoutes, writeSWARoutes } from "./utils";

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
        "npx @azure/static-web-apps-cli start {{ output.publicDir }} --api-location {{ output.serverDir }}",
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

const azureFunctions = defineNitroPreset(
  {
    serveStatic: true,
    entry: "./runtime/azure-functions",
    commands: {
      deploy:
        "az functionapp deployment source config-zip -g <resource-group> -n <app-name> --src {{ output.dir }}/deploy.zip",
    },
    hooks: {
      async compiled(ctx: Nitro) {
        await writeFunctionsRoutes(ctx);
      },
    },
  },
  {
    name: "azure-functions" as const,
    url: import.meta.url,
  }
);

export default [azure, azureFunctions] as const;
