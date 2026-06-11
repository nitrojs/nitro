import { fileURLToPath } from "node:url";
import { resolveModulePath } from "exsolve";
import { defineNitroPreset } from "nitropack/kit";
import type { Nitro } from "nitropack/types";
import {
  DEFAULT_QUEUE_HANDLER_ROUTE,
  deprecateSWR,
  generateEdgeFunctionFiles,
  generateFunctionFiles,
  generateStaticFiles,
} from "./utils";
import { builtnNodeModules } from "../_unenv/node-compat/vercel";

export type { VercelOptions as PresetOptions } from "./types";

// https://vercel.com/docs/build-output-api/v3

const vercel = defineNitroPreset(
  {
    extends: "node",
    entry: "./runtime/vercel",
    vercel: {
      skewProtection: !!process.env.VERCEL_SKEW_PROTECTION_ENABLED,
    },
    output: {
      dir: "{{ rootDir }}/.vercel/output",
      serverDir: "{{ output.dir }}/functions/__fallback.func",
      publicDir: "{{ output.dir }}/static/{{ baseURL }}",
    },
    commands: {
      preview: "",
      deploy: "npx vercel deploy --prebuilt",
    },
    hooks: {
      "build:before": (nitro: Nitro) => {
        // Queue consumer handler
        const queues = nitro.options.vercel?.queues;
        if (queues?.triggers?.length) {
          const resolved = resolveModulePath("@vercel/queue", {
            from: [nitro.options.rootDir, import.meta.url],
            try: true,
          });
          if (!resolved) {
            throw new Error(
              "`@vercel/queue` is required for Vercel Queues. Please add it to your dependencies."
            );
          }
          nitro.options.handlers.push({
            route: queues.handlerRoute || DEFAULT_QUEUE_HANDLER_ROUTE,
            lazy: true,
            handler: fileURLToPath(
              new URL("runtime/queue-handler", import.meta.url)
            ),
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
    url: import.meta.url,
  }
);

const vercelEdge = defineNitroPreset(
  {
    extends: "base-worker",
    entry: "./runtime/vercel-edge",
    exportConditions: ["edge-light"],
    output: {
      dir: "{{ rootDir }}/.vercel/output",
      serverDir: "{{ output.dir }}/functions/__fallback.func",
      publicDir: "{{ output.dir }}/static/{{ baseURL }}",
    },
    commands: {
      preview: "",
      deploy: "npx vercel deploy --prebuilt",
    },
    unenv: {
      external: builtnNodeModules.flatMap((m) => `node:${m}`),
      alias: {
        ...Object.fromEntries(
          builtnNodeModules.flatMap((m) => [
            [m, `node:${m}`],
            [`node:${m}`, `node:${m}`],
          ])
        ),
      },
    },
    rollupConfig: {
      output: {
        format: "module",
      },
    },
    wasm: {
      lazy: true,
      esmImport: false,
    },
    hooks: {
      "rollup:before": (nitro: Nitro) => {
        deprecateSWR(nitro);
      },
      async compiled(nitro: Nitro) {
        await generateEdgeFunctionFiles(nitro);
      },
    },
  },
  {
    name: "vercel-edge" as const,
    url: import.meta.url,
  }
);

const vercelStatic = defineNitroPreset(
  {
    extends: "static",
    vercel: {
      skewProtection: !!process.env.VERCEL_SKEW_PROTECTION_ENABLED,
    },
    output: {
      dir: "{{ rootDir }}/.vercel/output",
      publicDir: "{{ output.dir }}/static/{{ baseURL }}",
    },
    commands: {
      preview: "npx serve {{ output.publicDir }}",
      deploy: "npx vercel deploy --prebuilt",
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
    url: import.meta.url,
  }
);

export const vercelDev = defineNitroPreset(
  {
    extends: "nitro-dev",
    modules: [
      async (nitro) => await import("./dev").then((m) => m.vercelDev(nitro)),
    ],
  },
  {
    name: "vercel-dev" as const,
    aliases: ["vercel"],
    dev: true,
    url: import.meta.url,
  }
);

export default [vercel, vercelEdge, vercelStatic, vercelDev] as const;
