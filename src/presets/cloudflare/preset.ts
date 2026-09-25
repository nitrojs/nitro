import { defineNitroPreset } from "../_utils/preset.ts";
import { writeFile } from "../_utils/fs.ts";
import type { Nitro } from "nitro/types";
import { join, resolve } from "pathe";
import { presetsDir } from "nitro/meta";
import { unenvCfExternals } from "./unenv/preset.ts";
import {
  enableNodeCompat,
  writeWranglerConfig,
  writeCFRoutes,
  writeCFHeaders,
  writeCFPagesRedirects,
} from "./utils.ts";
import { setupEntryExports } from "./entry-exports.ts";
import { cloudflareOutputRewrites } from "./output-plugins.ts";

export type { CloudflareOptions as PresetOptions } from "./types.ts";

const cloudflarePages = defineNitroPreset(
  {
    extends: "base-worker",
    entry: "./cloudflare/runtime/cloudflare-pages",
    exportConditions: ["workerd", "worker"],
    minify: false,
    commands: {
      preview: "npx wrangler --cwd ./ pages dev",
      deploy: "npx wrangler --cwd ./ pages deploy",
    },
    output: {
      dir: "{{ rootDir }}/dist",
      publicDir: "{{ output.dir }}/{{ baseURL }}",
      serverDir: "{{ output.dir }}/_worker.js",
    },
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
      plugins: [cloudflareOutputRewrites()],
    },
    hooks: {
      "build:before": async (nitro) => {
        nitro.options.unenv.push(unenvCfExternals);
        await enableNodeCompat(nitro);
        await setupEntryExports(nitro);
      },
      async compiled(nitro: Nitro) {
        await writeWranglerConfig(nitro, "pages");
        await writeCFRoutes(nitro);
        await writeCFHeaders(nitro, "output");
        await writeCFPagesRedirects(nitro);
      },
    },
  },
  {
    name: "cloudflare-pages" as const,
    stdName: "cloudflare_pages",
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
        await writeCFHeaders(nitro, "output");
        await writeCFPagesRedirects(nitro);
      },
    },
  },
  {
    name: "cloudflare-pages-static" as const,
    stdName: "cloudflare_pages",

    static: true,
  }
);

export const cloudflareDev = defineNitroPreset(
  {
    extends: "nitro-dev",
    devServer: {
      runner: "miniflare",
    },
    hooks: {
      "build:before": (nitro) => {
        // The bridge imports `cloudflare:workers`, only available in workerd
        if (nitro.options.devServer.runner === "miniflare") {
          setupTracingBridge(nitro);
        }
      },
    },
  },
  {
    name: "cloudflare-dev" as const,
    aliases: ["cloudflare-module", "cloudflare-durable", "cloudflare-pages"],
    compatibilityDate: "2025-07-13",
    dev: true,
  }
);

const cloudflareModule = defineNitroPreset(
  {
    extends: "base-worker",
    entry: "./cloudflare/runtime/cloudflare-module",
    output: {
      publicDir: "{{ output.dir }}/public/{{ baseURL }}",
    },
    exportConditions: ["workerd", "worker"],
    minify: false,
    commands: {
      preview: "npx wrangler --cwd ./ dev",
      deploy: "npx wrangler --cwd ./ deploy",
    },
    rollupConfig: {
      output: {
        format: "esm",
        exports: "named",
        inlineDynamicImports: false,
      },
      plugins: [cloudflareOutputRewrites()],
    },
    wasm: {
      lazy: false,
      esmImport: true,
    },
    hooks: {
      "build:before": async (nitro) => {
        nitro.options.unenv.push(unenvCfExternals);
        await enableNodeCompat(nitro);
        await setupEntryExports(nitro);
        setupTracingBridge(nitro);
      },
      async compiled(nitro: Nitro) {
        await writeWranglerConfig(nitro, "module");
        await writeCFHeaders(nitro, "public");

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
  }
);

const cloudflareDurable = defineNitroPreset(
  {
    extends: "cloudflare-module",
    entry: "./cloudflare/runtime/cloudflare-durable",
  },
  {
    name: "cloudflare-durable" as const,
  }
);

export default [
  cloudflarePages,
  cloudflarePagesStatic,
  cloudflareModule,
  cloudflareDurable,
  cloudflareDev,
];

/**
 * Export tracing-channel spans as Cloudflare custom spans (`tracing.enterSpan`)
 * Registered first (unshift) so the bridge subscribes to the traced channels at
 * startup, before any request is handled.
 */
function setupTracingBridge(nitro: Nitro) {
  if (!nitro.options.tracingChannel) {
    return;
  }
  nitro.options.plugins ??= [];

  nitro.options.plugins.unshift(join(presetsDir, "cloudflare/runtime/telemetry/plugin"));
}
