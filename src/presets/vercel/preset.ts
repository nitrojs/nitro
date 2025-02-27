import { defineNitroPreset } from "nitropack/kit";
import type { Nitro } from "nitropack/types";
import {
  deprecateSWR,
  generateEdgeFunctionFiles,
  generateFunctionFiles,
  generateStaticFiles,
} from "./utils";

export type { VercelOptions as PresetOptions } from "./types";

// https://vercel.com/docs/build-output-api/v3

const vercel = defineNitroPreset(
  {
    extends: "node",
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

const vercelEdge = defineNitroPreset(
  {
    extends: "base-worker",
    entry: "./runtime/vercel-edge",
    exportConditions: ["edge-light"],
    output: {
      dir: "{{ rootDir }}/.vercel/output",
      serverDir: "{{ output.dir }}/functions/__nitro.func",
      publicDir: "{{ output.dir }}/static/{{ baseURL }}",
    },
    commands: {
      deploy: "",
      preview: "",
    },
    rollupConfig: {
      output: {
        format: "module",
      },
    },
    unenv: {
      inject: {
        process: undefined,
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

export default [vercel, vercelEdge, vercelStatic] as const;
