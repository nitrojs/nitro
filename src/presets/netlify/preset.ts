import { promises as fsp } from "node:fs";
import { defineNitroPreset } from "../_utils/preset.ts";
import type { Nitro } from "nitro/types";
import type { Config, Manifest } from "@netlify/edge-functions";
import { dirname, join } from "pathe";
import { unenvDeno } from "../deno/unenv/preset.ts";
import {
  generateNetlifyFunction,
  getGeneratorString,
  getStaticPaths,
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
      dir: "{{ rootDir }}/.netlify/functions-internal",
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

        await fsp.writeFile(
          join(nitro.options.output.dir, "server", "server.mjs"),
          generateNetlifyFunction(nitro)
        );

        if (nitro.options.netlify?.images) {
          nitro.options.netlify.config ||= {};
          nitro.options.netlify.config.images ||= nitro.options.netlify?.images;
        }

        if (Object.keys(nitro.options.netlify?.config || {}).length > 0) {
          const configPath = join(nitro.options.output.dir, "../deploy/v1/config.json");
          await fsp.mkdir(dirname(configPath), { recursive: true });
          await fsp.writeFile(configPath, JSON.stringify(nitro.options.netlify?.config), "utf8");
        }
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
      serverDir: "{{ rootDir }}/.netlify/edge-functions/server",
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
        entryFileNames: "server.js",
        format: "esm",
      },
    },
    unenv: unenvDeno,
    hooks: {
      async compiled(nitro: Nitro) {
        await writeHeaders(nitro);
        await writeRedirects(nitro);

        // https://docs.netlify.com/edge-functions/create-integration/
        const manifest: Manifest = {
          version: 1,
          functions: [
            {
              path: "/*",
              excludedPath: getStaticPaths(
                nitro.options.publicAssets,
                nitro.options.baseURL
              ) as Config["excludedPath"],
              name: "edge server handler",
              function: "server",
              generator: getGeneratorString(nitro),
            },
          ],
        };
        const manifestPath = join(nitro.options.rootDir, ".netlify/edge-functions/manifest.json");
        await fsp.mkdir(dirname(manifestPath), { recursive: true });
        await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
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
