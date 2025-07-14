import { promises as fsp } from "node:fs";
import { defineNitroPreset } from "nitropack/kit";
import type { Nitro } from "nitropack/types";
import { dirname, join } from "pathe";
import { unenvDenoPreset } from "../_unenv/preset-deno";
import netlifyLegacyPresets from "./legacy/preset";
import {
  generateNetlifyFunction,
  getGeneratorString,
  getStaticPaths,
  writeHeaders,
  writeRedirects,
} from "./utils";

export type { NetlifyOptions as PresetOptions } from "./types";

// Netlify functions
const netlify = defineNitroPreset(
  {
    entry: "./runtime/netlify",
    output: {
      dir: "{{ rootDir }}/.netlify/functions-internal",
      publicDir: "{{ rootDir }}/dist/{{ baseURL }}",
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

        if (nitro.options.netlify) {
          const configPath = join(
            nitro.options.output.dir,
            "../deploy/v1/config.json"
          );
          await fsp.mkdir(dirname(configPath), { recursive: true });
          await fsp.writeFile(
            configPath,
            JSON.stringify(nitro.options.netlify),
            "utf8"
          );
        }
      },
    },
  },
  {
    name: "netlify" as const,
    stdName: "netlify",
    url: import.meta.url,
    compatibilityDate: "2024-05-07",
  }
);

// Netlify edge
const netlifyEdge = defineNitroPreset(
  {
    extends: "base-worker",
    entry: "./runtime/netlify-edge",
    exportConditions: ["netlify"],
    output: {
      serverDir: "{{ rootDir }}/.netlify/edge-functions/server",
      publicDir: "{{ rootDir }}/dist/{{ baseURL }}",
    },
    rollupConfig: {
      output: {
        entryFileNames: "server.js",
        format: "esm",
      },
    },
    unenv: unenvDenoPreset,
    hooks: {
      async compiled(nitro: Nitro) {
        await writeHeaders(nitro);
        await writeRedirects(nitro);

        // https://docs.netlify.com/edge-functions/create-integration/
        const manifest = {
          version: 1,
          functions: [
            {
              path: "/*",
              excludedPath: getStaticPaths(
                nitro.options.publicAssets,
                nitro.options.baseURL
              ),
              name: "edge server handler",
              function: "server",
              generator: getGeneratorString(nitro),
              cache: "manual",
            },
          ],
        };
        const manifestPath = join(
          nitro.options.rootDir,
          ".netlify/edge-functions/manifest.json"
        );
        await fsp.mkdir(dirname(manifestPath), { recursive: true });
        await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      },
    },
  },
  {
    name: "netlify-edge" as const,
    url: import.meta.url,
    compatibilityDate: "2024-05-07",
  }
);

const netlifyStatic = defineNitroPreset(
  {
    extends: "static",
    output: {
      dir: "{{ rootDir }}/dist",
      publicDir: "{{ rootDir }}/dist/{{ baseURL }}",
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
    url: import.meta.url,
    compatibilityDate: "2024-05-07",
  }
);

export default [
  ...netlifyLegacyPresets,
  netlify,
  netlifyEdge,
  netlifyStatic,
] as const;
