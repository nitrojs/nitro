import { defineNitroPreset } from "../_utils/preset.ts";
import type { Nitro } from "nitro/types";
import { presetsDir } from "nitro/meta";
import { join } from "pathe";
import { importDep } from "../../utils/dep.ts";
import {
  deprecateSWR,
  generateFunctionFiles,
  generateStaticFiles,
  resolveVercelRuntime,
} from "./utils.ts";
import { IMMUTABLE_DIR, generateImmutableManifest } from "./immutable.ts";
import { vercelDevModule } from "./dev.ts";

import type { VercelFunctionTrigger } from "./types.ts";

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
      cronHandlerRoute: "/_vercel/cron",
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

        // Immutable static files: emit content-addressed client assets under the
        // reserved `_vercel/immutable` base so they can be shared across
        // deployments. Enabled when the project opts in via Vercel.
        if (process.env.VERCEL_IMMUTABLE_DEPLOYMENT_ID) {
          nitro.options.output.clientAssetsDir = IMMUTABLE_DIR;
        }

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

        // Export tracing-channel spans to the Vercel runtime. Registered first
        // (unshift) so it subscribes to the traced channels at startup, before
        // any request is handled.
        if (nitro.options.tracingChannel) {
          nitro.options.plugins ??= [];
          nitro.options.plugins.unshift(join(presetsDir, "vercel/runtime/telemetry/plugin"));
        }

        // Cron tasks handler
        if (
          nitro.options.experimental.tasks &&
          Object.keys(nitro.options.scheduledTasks || {}).length > 0
        ) {
          nitro.options.handlers.push({
            route: nitro.options.vercel!.cronHandlerRoute || "/_vercel/cron",
            lazy: true,
            handler: join(presetsDir, "vercel/runtime/cron-handler"),
          });
        }

        // Queue consumer handler
        const queues = nitro.options.vercel?.queues;
        if (queues?.triggers?.length) {
          await importDep({
            id: "@vercel/queue",
            dir: nitro.options.rootDir,
            reason: "Vercel Queues",
          });

          const handlerRoute = queues.handlerRoute || "/_vercel/queues/consumer";

          nitro.options.handlers.push({
            route: handlerRoute,
            lazy: true,
            handler: join(presetsDir, "vercel/runtime/queue-handler"),
          });

          const queueTriggers: VercelFunctionTrigger[] = queues.triggers.map(
            ({ topic, ...opts }) => ({ type: "queue/v2beta", topic, ...opts })
          );
          nitro.options.vercel ??= {};
          nitro.options.vercel.functionRules ??= {};
          const existingRule = nitro.options.vercel.functionRules[handlerRoute];
          nitro.options.vercel.functionRules[handlerRoute] = {
            ...existingRule,
            experimentalTriggers: [...(existingRule?.experimentalTriggers || []), ...queueTriggers],
          };
        }
      },
      "rollup:before": (nitro: Nitro) => {
        deprecateSWR(nitro);
      },
      async compiled(nitro: Nitro) {
        await generateFunctionFiles(nitro);
        await generateImmutableManifest(nitro);
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
        await generateImmutableManifest(nitro);
      },
    },
  },
  {
    name: "vercel-static" as const,
    stdName: "vercel",
    static: true,
  }
);

export const vercelDev = defineNitroPreset(
  {
    extends: "nitro-dev",
    devServer: { runner: "vercel" },
    modules: [vercelDevModule],
  },
  {
    name: "vercel-dev" as const,
    aliases: ["vercel"],
    dev: true,
  }
);

export default [vercel, vercelStatic, vercelDev] as const;
