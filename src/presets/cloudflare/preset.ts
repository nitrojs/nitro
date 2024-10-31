import { defineNitroPreset } from "nitropack/kit";
import { writeFile } from "nitropack/kit";
import type { Nitro } from "nitropack/types";
import { resolve } from "pathe";
import { writeCFPagesFiles, writeCFPagesStaticFiles } from "./utils";

export type { CloudflareOptions as PresetOptions } from "./types";

const cloudflarePages = defineNitroPreset(
  {
    extends: "cloudflare",
    entry: "./runtime/cloudflare-pages",
    exportConditions: ["workerd"],
    commands: {
      preview: "npx wrangler pages dev ./",
      deploy: "npx wrangler pages deploy ./",
    },
    output: {
      dir: "{{ rootDir }}/dist",
      publicDir: "{{ output.dir }}",
      serverDir: "{{ output.dir }}/_worker.js",
    },
    alias: {
      // Hotfix: Cloudflare appends /index.html if mime is not found and things like ico are not in standard lite.js!
      // https://github.com/unjs/nitro/pull/933
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
      async compiled(nitro: Nitro) {
        await writeCFPagesFiles(nitro);
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
      publicDir: "{{ rootDir }}/dist",
    },
    commands: {
      preview: "npx wrangler pages dev dist",
      deploy: "npx wrangler pages deploy dist",
    },
    hooks: {
      async compiled(nitro: Nitro) {
        await writeCFPagesStaticFiles(nitro);
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

const cloudflare = defineNitroPreset(
  {
    extends: "base-worker",
    entry: "./runtime/cloudflare-worker",
    exportConditions: ["workerd"],
    commands: {
      preview: "npx wrangler dev ./server/index.mjs --site ./public",
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
      preview: "npx wrangler dev ./server/index.mjs --site ./public",
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
    compatibilityDate: "2024-05-07",
    url: import.meta.url,
  }
);

const cloudflareModule = defineNitroPreset(
  {
    extends: "base-worker",
    entry: "./runtime/cloudflare-module",
    exportConditions: ["workerd"],
    commands: {
      preview: "npx wrangler dev ./server/index.mjs --assets ./public/",
      deploy: "npx wrangler deploy",
    },
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
    name: "cloudflare-module" as const,
    compatibilityDate: "2024-09-19",
    url: import.meta.url,
  }
);

const cloudflareDurable = defineNitroPreset(
  {
    extends: "cloudflare-module",
    entry: "./runtime/cloudflare-durable",
    rollupConfig: {
      external: ["cloudflare:workers"],
    },
  },
  {
    name: "cloudflare-durable" as const,
    url: import.meta.url,
  }
);

export default [
  cloudflare,
  cloudflareModuleLegacy,
  cloudflareModule,
  cloudflareDurable,
  cloudflarePages,
  cloudflarePagesStatic,
];
