import { promises as fsp } from "node:fs";
import { defineNitroPreset } from "../_utils/preset.ts";
import type { Nitro } from "nitro/types";
import { join } from "pathe";
import { unenvDeno } from "../deno/unenv/preset.ts";
import { extendEnv } from "../../build/env.ts";
import {
  generateNetlifyEdgeFunction,
  generateNetlifyFunction,
  writeConfig,
  writeHeaders,
  writeRedirects,
} from "./utils.ts";

export type { NetlifyOptions as PresetOptions } from "./types.ts";

// Netlify functions
const netlify = defineNitroPreset(
  {
    entry: "./netlify/runtime/netlify",
    manifest: {
      deploymentId: process.env.DEPLOY_ID,
    },
    output: {
      dir: "{{ rootDir }}/.netlify/v1/functions",
      publicDir: "{{ rootDir }}/dist/{{ baseURL }}",
    },
    prerender: {
      // Prevents an unnecessary redirect from /page/ to /page when accessing prerendered content.
      // Reference: https://answers.netlify.com/t/support-guide-how-can-i-alter-trailing-slash-behaviour-in-my-urls-will-enabling-pretty-urls-help/31191
      // Reference: https://nitro.build/config#prerender
      autoSubfolderIndex: false,
    },
    rollupConfig: {
      output: {
        entryFileNames: "main.mjs",
      },
    },
    hooks: {
      async compiled(nitro: Nitro) {
        await writeHeaders(nitro);
        await writeRedirects(nitro);
        await writeConfig(nitro, join(nitro.options.output.dir, "../config.json"));

        await fsp.writeFile(
          join(nitro.options.output.dir, "server", "server.mjs"),
          generateNetlifyFunction(nitro)
        );
      },
    },
  },
  {
    name: "netlify" as const,
    stdName: "netlify",
  }
);

// Netlify edge
const netlifyEdge = defineNitroPreset(
  {
    extends: "base-worker",
    entry: "./netlify/runtime/netlify-edge",
    manifest: {
      deploymentId: process.env.DEPLOY_ID,
    },
    exportConditions: ["netlify"],
    output: {
      serverDir: "{{ rootDir }}/.netlify/v1/edge-functions/server",
      publicDir: "{{ rootDir }}/dist/{{ baseURL }}",
    },
    prerender: {
      // Prevents an unnecessary redirect from /page/ to /page when accessing prerendered content.
      // Reference: https://answers.netlify.com/t/support-guide-how-can-i-alter-trailing-slash-behaviour-in-my-urls-will-enabling-pretty-urls-help/31191
      // Reference: https://nitro.build/config#prerender
      autoSubfolderIndex: false,
    },
    rollupConfig: {
      output: {
        entryFileNames: "main.mjs",
        format: "esm",
        inlineDynamicImports: false,
      },
    },
    hooks: {
      "build:before": (nitro: Nitro) => {
        extendEnv(nitro, unenvDeno);
      },
      async compiled(nitro: Nitro) {
        await writeHeaders(nitro);
        await writeRedirects(nitro);
        await writeConfig(nitro, join(nitro.options.output.serverDir, "../../config.json"));

        await fsp.writeFile(
          join(nitro.options.output.serverDir, "server.mjs"),
          generateNetlifyEdgeFunction(nitro)
        );
      },
    },
  },
  {
    name: "netlify-edge" as const,
  }
);

const netlifyStatic = defineNitroPreset(
  {
    extends: "static",
    manifest: {
      deploymentId: process.env.DEPLOY_ID,
    },
    output: {
      dir: "{{ rootDir }}/dist",
      publicDir: "{{ rootDir }}/dist/{{ baseURL }}",
    },
    prerender: {
      // Prevents an unnecessary redirect from /page/ to /page when accessing prerendered content.
      // Reference: https://answers.netlify.com/t/support-guide-how-can-i-alter-trailing-slash-behaviour-in-my-urls-will-enabling-pretty-urls-help/31191
      // Reference: https://nitro.build/config#prerender
      autoSubfolderIndex: false,
    },
    commands: {
      preview: "npx serve ./",
    },
    hooks: {
      async compiled(nitro: Nitro) {
        await writeHeaders(nitro);
        await writeRedirects(nitro);
      },
    },
  },
  {
    name: "netlify-static" as const,
    stdName: "netlify",
    static: true,
  }
);

export default [netlify, netlifyEdge, netlifyStatic] as const;
