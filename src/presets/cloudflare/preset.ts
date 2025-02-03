import { defineNitroPreset } from "nitropack/kit";
import { writeFile } from "nitropack/kit";
import type { Nitro } from "nitropack/types";
import { resolve } from "pathe";
import {
  writeWranglerConfig,
  writeCFRoutes,
  writeCFPagesHeaders,
  writeCFPagesRedirects,
} from "./utils";

export type { CloudflareOptions as PresetOptions } from "./types";

const cloudflareExternals = [
  // https://developers.cloudflare.com/email-routing/email-workers/reply-email-workers/
  "cloudflare:email",
  // https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/
  "cloudflare:sockets",
  // https://developers.cloudflare.com/durable-objects/get-started/walkthrough/
  "cloudflare:workers",
  // https://developers.cloudflare.com/workflows/build/workers-api/
  "cloudflare:workflows",
] as const;

// TODO: Remove when wrangler -C support landed
// https://github.com/cloudflare/workers-sdk/pull/7994
const isWindows = process.platform === "win32";
const commandWithDir = (command: string) =>
  isWindows ? `cmd /c ${command}` : `(cd ./ && ${command})`;

const cloudflarePages = defineNitroPreset(
  {
    extends: "cloudflare",
    entry: "./runtime/cloudflare-pages",
    exportConditions: ["workerd"],
    commands: {
      preview: commandWithDir("npx wrangler pages dev"),
      deploy: commandWithDir("npx wrangler pages deploy"),
    },
    output: {
      dir: "{{ rootDir }}/dist",
      publicDir: "{{ output.dir }}/{{ baseURL }}",
      serverDir: "{{ output.dir }}/_worker.js",
    },
    unenv: {
      external: [...cloudflareExternals],
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
    },
    hooks: {
      async compiled(nitro: Nitro) {
        await writeWranglerConfig(nitro, true /* pages */);
        await writeCFRoutes(nitro);
        await writeCFPagesHeaders(nitro);
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
      preview: commandWithDir("npx wrangler pages dev"),
      deploy: commandWithDir("npx wrangler pages deploy"),
    },
    hooks: {
      async compiled(nitro: Nitro) {
        await writeWranglerConfig(nitro, true /* pages */);
        await writeCFPagesHeaders(nitro);
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
    unenv: {
      external: [...cloudflareExternals],
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
    unenv: {
      external: [...cloudflareExternals],
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

const cloudflareModule = defineNitroPreset(
  {
    extends: "base-worker",
    entry: "./runtime/cloudflare-module",
    exportConditions: ["workerd"],
    commands: {
      preview: commandWithDir("npx wrangler dev"),
      deploy: commandWithDir("npx wrangler deploy"),
    },
    unenv: {
      external: [...cloudflareExternals],
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
        await writeWranglerConfig(nitro, false /* module */);
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
    unenv: {
      external: [...cloudflareExternals],
    },
  },
  {
    name: "cloudflare-durable" as const,
    compatibilityDate: "2024-09-19",
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
