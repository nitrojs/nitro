import { promises as fsp } from "node:fs";
import { defineNitroPreset } from "nitropack/kit";
import type { Nitro } from "nitropack/types";
import { dirname, join } from "pathe";
import { deprecateSWR, writeHeaders, writeRedirects } from "./utils";

// Netlify functions
const netlify = defineNitroPreset(
  {
    extends: "aws-lambda",
    entry: "./runtime/netlify",
    output: {
      dir: "{{ rootDir }}/.netlify/functions-internal",
      publicDir: "{{ rootDir }}/dist",
    },
    rollupConfig: {
      output: {
        entryFileNames: "server.mjs",
      },
    },
    hooks: {
      "rollup:before": (nitro: Nitro) => {
        deprecateSWR(nitro);
      },
      async compiled(nitro: Nitro) {
        await writeHeaders(nitro);
        await writeRedirects(nitro, "/.netlify/functions/server");

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

        const functionConfig = {
          config: { nodeModuleFormat: "esm" },
          version: 1,
        };
        const functionConfigPath = join(
          nitro.options.output.serverDir,
          "server.json"
        );
        await fsp.writeFile(functionConfigPath, JSON.stringify(functionConfig));
      },
    },
  },
  {
    name: "netlify-legacy" as const,
    aliases: ["netlify"],
    url: import.meta.url,
  }
);

// Netlify builder
const netlifyBuilder = defineNitroPreset(
  {
    extends: "netlify",
    entry: "./runtime/netlify-builder",
    hooks: {
      "rollup:before": (nitro: Nitro) => {
        deprecateSWR(nitro);
      },
    },
  },
  {
    name: "netlify-builder" as const,
    url: import.meta.url,
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
      publicDir: "{{ rootDir }}/dist",
    },
    rollupConfig: {
      output: {
        entryFileNames: "server.js",
        format: "esm",
      },
    },
    hooks: {
      "rollup:before": (nitro: Nitro) => {
        deprecateSWR(nitro);
      },
      async compiled(nitro: Nitro) {
        await writeHeaders(nitro);
        await writeRedirects(nitro);

        // https://docs.netlify.com/edge-functions/create-integration/
        const manifest = {
          version: 1,
          functions: [
            {
              path: "/*",
              name: "nitro server handler",
              function: "server",
              generator: `${nitro.options.framework.name}@${nitro.options.framework.version}`,
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
  }
);

const netlifyStatic = defineNitroPreset(
  {
    extends: "static",
    output: {
      dir: "{{ rootDir }}/dist",
      publicDir: "{{ rootDir }}/dist",
    },
    commands: {
      preview: "npx serve {{ output.dir }}",
    },
    hooks: {
      "rollup:before": (nitro: Nitro) => {
        deprecateSWR(nitro);
      },
      async compiled(nitro: Nitro) {
        await writeHeaders(nitro);
        await writeRedirects(nitro);
      },
    },
  },
  {
    name: "netlify-static" as const,
    url: import.meta.url,
    static: true,
  }
);

export default [netlify, netlifyBuilder, netlifyEdge, netlifyStatic] as const;
