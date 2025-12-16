import { defineNitroPreset } from "nitropack/kit";
import { writeFile } from "nitropack/kit";
import type { Nitro } from "nitropack/types";
import { resolve } from "pathe";

export type { CloudflareOptions as PresetOptions } from "./types";

const cloudflare = defineNitroPreset(
  {
    extends: "base-worker",
    entry: "./runtime/cloudflare-worker",
    exportConditions: ["workerd"],
    commands: {
      preview:
        "npx wrangler dev {{ output.serverDir }}/index.mjs --site {{ output.publicDir }}",
      deploy: "npx wrangler deploy",
    },
    wasm: {
      lazy: true,
    },
    hooks: {
      async compiled(nitro: Nitro) {
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
    name: "cloudflare-worker" as const,
    aliases: ["cloudflare"] as const,
    url: import.meta.url,
  }
);

const cloudflareModuleLegacy = defineNitroPreset(
  {
    extends: "base-worker",
    entry: "./runtime/cloudflare-module-legacy",
    exportConditions: ["workerd"],
    commands: {
      preview:
        "npx wrangler dev {{ output.serverDir }}/index.mjs --site {{ output.publicDir }}",
      deploy: "npx wrangler deploy",
    },
    rollupConfig: {
      external: "__STATIC_CONTENT_MANIFEST",
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
      async compiled(nitro: Nitro) {
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
    name: "cloudflare-module-legacy" as const,
    aliases: ["cloudflare-module"] as const,
    url: import.meta.url,
  }
);

export default [cloudflare, cloudflareModuleLegacy];
