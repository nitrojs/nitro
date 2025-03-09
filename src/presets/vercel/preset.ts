import { defineNitroPreset } from "../_utils/preset";
import type { Nitro } from "nitro/types";
import {
  deprecateSWR,
  generateFunctionFiles,
  generateStaticFiles,
} from "./utils";

export type { VercelOptions as PresetOptions } from "./types";

// https://vercel.com/docs/build-output-api/v3

const vercel = defineNitroPreset(
  {
    entry: "./runtime/vercel",
    output: {
      dir: "{{ rootDir }}/.vercel/output",
      serverDir: "{{ output.dir }}/functions/__nitro.func",
      publicDir: "{{ output.dir }}/static/{{ baseURL }}",
    },
    commands: {
      deploy: "",
      preview: "",
    },
    hooks: {
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
    url: import.meta.url,
  }
);

export default [vercel, vercelStatic] as const;
