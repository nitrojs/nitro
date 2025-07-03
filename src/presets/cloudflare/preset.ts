import { defineNitroPreset } from "nitropack/kit";
import { writeFile } from "nitropack/kit";
import type { Nitro } from "nitropack/types";
import { resolve } from "pathe";
import { unenvCfExternals } from "../_unenv/preset-workerd";
import {
  enableNodeCompat,
  writeWranglerConfig,
  writeCFRoutes,
  writeCFHeaders,
  writeCFPagesRedirects,
} from "./utils";

import cfLegacyPresets from "./preset-legacy";

export type { CloudflareOptions as PresetOptions } from "./types";

const cloudflarePages = defineNitroPreset(
  {
    extends: "cloudflare",
    entry: "./runtime/cloudflare-pages",
    exportConditions: ["workerd"],
    commands: {
      preview: "npx wrangler --cwd ./ pages dev",
      deploy: "npx wrangler --cwd ./ pages deploy",
    },
    output: {
      dir: "{{ rootDir }}/dist",
      publicDir: "{{ output.dir }}/{{ baseURL }}",
      serverDir: "{{ output.dir }}/_worker.js",
    },
    unenv: [unenvCfExternals],
    alias: {
      // Hotfix: Cloudflare appends /index.html if mime is not found and things like ico are not in standard lite.js!
      // https://github.com/nitrojs/nitro/pull/933
      _mime: "mime/index.js",
    },
    wasm: {
      lazy: false,
      esmImport: true,
    },
    rollupConfig: {
      output: {
        entryFileNames: "index.js",
        format: "esm",
        inlineDynamicImports: false,
      },
    },
    hooks: {
      "build:before": async (nitro) => {
        await enableNodeCompat(nitro);
      },
      async compiled(nitro: Nitro) {
        await writeWranglerConfig(nitro, "pages");
        await writeCFRoutes(nitro);
        await writeCFHeaders(nitro);
        await writeCFPagesRedirects(nitro);
      },
    },
  },
  {
    name: "cloudflare-pages" as const,
    stdName: "cloudflare_pages",
    url: import.meta.url,
  }
);

const cloudflarePagesStatic = defineNitroPreset(
  {
    extends: "static",
    output: {
      dir: "{{ rootDir }}/dist",
      publicDir: "{{ output.dir }}/{{ baseURL }}",
    },
    commands: {
      preview: "npx wrangler --cwd ./ pages dev",
      deploy: "npx wrangler --cwd ./ pages deploy",
    },
    hooks: {
      async compiled(nitro: Nitro) {
        await writeCFHeaders(nitro);
        await writeCFPagesRedirects(nitro);
      },
    },
  },
  {
    name: "cloudflare-pages-static" as const,
    stdName: "cloudflare_pages",
    url: import.meta.url,
    static: true,
  }
);

const cloudflareModule = defineNitroPreset(
  {
    extends: "base-worker",
    entry: "./runtime/cloudflare-module",
    output: {
      publicDir: "{{ output.dir }}/public/{{ baseURL }}",
    },
    exportConditions: ["workerd"],
    commands: {
      preview: "npx wrangler --cwd ./ dev",
      deploy: "npx wrangler --cwd ./ deploy",
    },
    unenv: [unenvCfExternals],
    rollupConfig: {
      output: {
        format: "esm",
        exports: "named",
        inlineDynamicImports: false,
      },
    },
    wasm: {
      lazy: false,
      esmImport: true,
    },
    hooks: {
      "build:before": async (nitro) => {
        await enableNodeCompat(nitro);
      },
      async compiled(nitro: Nitro) {
        await writeWranglerConfig(nitro, "module");
        await writeCFHeaders(nitro);

        await writeFile(
          resolve(nitro.options.output.dir, "package.json"),
          JSON.stringify({ private: true, main: "./server/index.mjs" }, null, 2)
        );
        await writeFile(
          resolve(nitro.options.output.dir, "package-lock.json"),
          JSON.stringify({ lockfileVersion: 1 }, null, 2)
        );
      },
    },
  },
  {
    name: "cloudflare-module" as const,
    stdName: "cloudflare_workers",
    compatibilityDate: "2024-09-19",
    url: import.meta.url,
  }
);

const cloudflareDurable = defineNitroPreset(
  {
    extends: "cloudflare-module",
    entry: "./runtime/cloudflare-durable",
  },
  {
    name: "cloudflare-durable" as const,
    compatibilityDate: "2024-09-19",
    url: import.meta.url,
  }
);

export default [
  ...cfLegacyPresets,
  cloudflarePages,
  cloudflarePagesStatic,
  cloudflareModule,
  cloudflareDurable,
];
