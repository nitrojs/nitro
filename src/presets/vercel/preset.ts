import { defineNitroPreset } from "../_utils/preset.ts";
import type { Nitro } from "nitro/types";
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
    output: {
      dir: "{{ rootDir }}/.vercel/output",
      serverDir: "{{ output.dir }}/functions/__server.func",
      publicDir: "{{ output.dir }}/static/{{ baseURL }}",
    },
    commands: {
      deploy: "",
      preview: "",
    },
    hooks: {
      "build:before": async (nitro: Nitro) => {
        // Runtime
        const runtime = await resolveVercelRuntime(nitro);
        if (
          runtime.startsWith("bun") &&
          !nitro.options.exportConditions!.includes("bun")
        ) {
          nitro.options.exportConditions!.push("bun");
        }

        // Entry handler format
        nitro.options.entry = nitro.options.entry.replace(
          "{format}",
          nitro.options.vercel?.entryFormat === "node" ? "node" : "web"
        );
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
