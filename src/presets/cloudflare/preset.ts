import { defineNitroPreset } from "../_utils/preset.ts";
import { writeFile } from "../_utils/fs.ts";
import type { Nitro } from "nitro/types";
import type { Plugin } from "rollup";
import { resolve } from "pathe";
import { unenvCfExternals } from "./unenv/preset.ts";
import {
  enableNodeCompat,
  writeWranglerConfig,
  writeCFRoutes,
  writeCFHeaders,
  writeCFPagesRedirects,
} from "./utils.ts";
import { cloudflareDevModule } from "./dev.ts";
import { setupEntryExports } from "./entry-exports.ts";

// Some bundlers (e.g. rolldown-vite) emit `createRequire(import.meta.url)` in
// shared chunks. On Cloudflare Workers `import.meta.url` is `undefined`, which
// causes `createRequire` to throw at runtime. This output plugin rewrites those
// call sites to fall back to a synthetic `file:///` URL so that `createRequire`
// succeeds and any subsequent `require()` calls go through the normal Node.js
// compat layer provided by the Workers runtime.
// Ref: https://github.com/nitrojs/nitro/issues/4132
function guardCreateRequire(): Plugin {
  return {
    name: "nitro:cloudflare-guard-createRequire",
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === "chunk" && chunk.code?.includes("createRequire(import.meta.url)")) {
          chunk.code = chunk.code.replace(
            /createRequire\(import\.meta\.url\)/g,
            'createRequire(import.meta.url || "file:///")'
          );
        }
      }
    },
  };
}

// When code-splitting is enabled, bundlers hoist externalized `node:*` built-in
// imports as bare side-effect imports (`import "node:buffer"`) into entry and
// chunk files. These are no-ops (Node.js built-ins have no meaningful
// module-level side effects) but they can cause issues on worker runtimes where
// `node:*` modules may not be available or trigger unnecessary warnings.
const BARE_NODE_IMPORT_RE = /^import\s*['"]node:[^'"]+['"];?\s*$/gm;
function stripBareNodeImports(): Plugin {
  return {
    name: "nitro:cloudflare-strip-bare-node-imports",
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === "chunk" && chunk.code.includes("node:")) {
          chunk.code = chunk.code.replace(BARE_NODE_IMPORT_RE, "");
        }
      }
    },
  };
}

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
      plugins: [guardCreateRequire(), stripBareNodeImports()],
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
    modules: [cloudflareDevModule],
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
      plugins: [guardCreateRequire(), stripBareNodeImports()],
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
