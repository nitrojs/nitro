import { defineNitroPreset } from "../_utils/preset.ts";
import type { Nitro } from "nitro/types";
import { presetsDir } from "nitro/meta";
import { join } from "pathe";
import {
  deprecateSWR,
  generateFunctionFiles,
  generateStaticFiles,
  resolveVercelRuntime,
} from "./utils.ts";

export type { VercelOptions as PresetOptions } from "./types.ts";

// https://vercel.com/docs/build-output-api/v3

const vercel = defineNitroPreset(
  {
    entry: "./vercel/runtime/vercel.{format}",
    manifest: {
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
    },
    vercel: {
      skewProtection: !!process.env.VERCEL_SKEW_PROTECTION_ENABLED,
    },
    output: {
      dir: "{{ rootDir }}/.vercel/output",
      serverDir: "{{ output.dir }}/functions/__server.func",
      publicDir: "{{ output.dir }}/static/{{ baseURL }}",
    },
    commands: {
      preview: "npx srvx --static ../../static ./functions/__server.func/index.mjs",
      deploy: "npx vercel deploy --prebuilt",
    },
    hooks: {
      "build:before": async (nitro: Nitro) => {
        const logger = nitro.logger.withTag("vercel");

        // Runtime
        const runtime = await resolveVercelRuntime(nitro);
        if (runtime.startsWith("bun") && !nitro.options.exportConditions!.includes("bun")) {
          nitro.options.exportConditions!.push("bun");
        }
        logger.info(`Using \`${runtime}\` runtime.`);

        // Entry handler format
        let serverFormat = nitro.options.vercel?.entryFormat;
        if (!serverFormat) {
          const hasNodeHandler = nitro.routing.routes.routes
            .flatMap((r) => r.data)
            .some((h) => h.format === "node");
          serverFormat = hasNodeHandler ? "node" : "web";
        }
        logger.info(`Using \`${serverFormat}\` entry format.`);
        nitro.options.entry = nitro.options.entry.replace("{format}", serverFormat);

        // Cron tasks handler
        if (
          nitro.options.experimental.tasks &&
          Object.keys(nitro.options.scheduledTasks || {}).length > 0
        ) {
          nitro.options.handlers.push({
            route: "/_nitro/tasks/vercel",
            lazy: true,
            handler: join(presetsDir, "vercel/runtime/cron-handler"),
          });
        }
      },
      "rollup:before": (nitro: Nitro) => {
        deprecateSWR(nitro);
      },
      async compiled(nitro: Nitro) {
        await generateFunctionFiles(nitro);
      },
    },
  },
  {
    name: "vercel" as const,
    stdName: "vercel",
  }
);

const vercelStatic = defineNitroPreset(
  {
    extends: "static",
    manifest: {
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
    },
    vercel: {
      skewProtection: !!process.env.VERCEL_SKEW_PROTECTION_ENABLED,
    },
    output: {
      dir: "{{ rootDir }}/.vercel/output",
      publicDir: "{{ output.dir }}/static/{{ baseURL }}",
    },
    commands: {
      preview: "npx serve ./static",
    },
    hooks: {
      "rollup:before": (nitro: Nitro) => {
        deprecateSWR(nitro);
      },
      async compiled(nitro: Nitro) {
        await generateStaticFiles(nitro);
      },
    },
  },
  {
    name: "vercel-static" as const,
    stdName: "vercel",
    static: true,
  }
);

export default [vercel, vercelStatic] as const;
