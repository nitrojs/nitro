import { rm } from "node:fs/promises";
import { defineBuildConfig } from "obuild/config";

import { resolveModulePath } from "exsolve";
import { traceNodeModules } from "nf3";
import { parseNodeModulePath } from "mlly";

const pkg = await import("./package.json", { with: { type: "json" } }).then(
  (r) => r.default || r
);

export const distSubpaths = ["builder", "presets", "runtime", "types", "vite"];
export const libSubpaths = [
  "config",
  "meta",
  "h3",
  "runtime/meta",
  "deps/h3",
  "deps/ofetch",
];

const tracePkgs = [
  "cookie-es", // used by azure runtime
  "croner", // used by internal/task
  "defu", // used by open-api runtime
  "destr", // used by node-server and deno-server
  "get-port-please", // used by dev server
  "hookable", // used by app.ts
  "rendu", // used by HTML renderer template
  "scule", // used by runtime config
  "source-map", // used by dev error runtime
  "ufo", // used by presets and runtime
  "unctx", // used by internal/context
  "youch", // used by error handler
  "youch-core", // used by error handler
];

export default defineBuildConfig({
  entries: [
    {
      type: "bundle",
      input: [
        "src/builder.ts",
        "src/vite.ts",
        "src/cli/index.ts",
        "src/types/index.ts",
      ],
    },
    {
      type: "transform",
      input: "src/runtime/",
      outDir: "dist/runtime",
    },
    {
      type: "transform",
      input: "src/presets/",
      outDir: "dist/presets",
      filter: (id) => id.includes("runtime/"),
    },
  ],
  hooks: {
    rolldownConfig(config) {
      config.platform = "node";

      config.external ??= [];
      (config.external as string[]).push(
        "nitro",
        ...[...distSubpaths, ...libSubpaths].map(
          (subpath) => `nitro/${subpath}`
        ),
        ...Object.keys(pkg.dependencies),
        ...Object.keys(pkg.peerDependencies),
        ...tracePkgs,
        "typescript",
        "firebase-functions",
        "@scalar/api-reference",
        "get-port-please",
        "cloudflare:workers",
        "@cloudflare/workers-types",
        "rolldown-vite",
        // unplugin deps
        "@rspack/core",
        "@farmfe/core",
        "webpack",
        "unloader"
      );
    },
    rolldownOutput(config) {
      config.advancedChunks ||= {};
      config.advancedChunks.groups = [
        {
          test: /node_modules/,
          name: (moduleId) => {
            const pkgName = parseNodeModulePath(moduleId)
              ?.name?.split("/")
              .pop();
            return `_libs/${pkgName || "_common"}`;
          },
        },
        // {
        //   test: /src\/presets\/\w+\//,
        //   name: (moduleId) => {
        //     const presetName = /src\/presets\/(\w+)\//.exec(moduleId)?.[1];
        //     return `_presets/${presetName || "_common"}`;
        //   },
        // },
      ];

      // Use better chunk names (without degrading optimization)
      config.chunkFileNames = (chunk) => {
        if (chunk.name.startsWith("_")) {
          return `[name].mjs`;
        }
        if (chunk.moduleIds.every((id) => /src\/cli\//.test(id))) {
          return `cli/_chunks/[name].mjs`;
        }
        if (chunk.moduleIds.every((id) => /build\/vite\//.test(id))) {
          return `_build/vite.[name].mjs`;
        }
        if (chunk.moduleIds.every((id) => /build\/rolldown\//.test(id))) {
          return `_build/rolldown.mjs`;
        }
        if (
          chunk.moduleIds.every((id) =>
            /build\/rollup\/|build\/plugins/.test(id)
          )
        ) {
          return `_build/rollup.mjs`;
        }
        if (chunk.moduleIds.every((id) => /src\/dev\/|src\/runtime/.test(id))) {
          return `_dev.mjs`;
        }
        if (chunk.moduleIds.every((id) => /src\/presets/.test(id))) {
          return `_presets.mjs`;
        }
        if (
          chunk.moduleIds.every((id) => /src\/build\/|src\/presets/.test(id))
        ) {
          return `_build/common.mjs`;
        }
        return "_chunks/[hash].mjs";
      };
    },
    async end() {
      await traceNodeModules(
        tracePkgs.map((pkg) => resolveModulePath(pkg)),
        {}
      );
      for (const dep of [
        ...Object.keys(pkg.dependencies),
        ...Object.keys(pkg.peerDependencies),
      ]) {
        await rm(`dist/node_modules/${dep}`, { recursive: true, force: true });
      }
    },
  },
});
