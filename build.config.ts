import { defineBuildConfig } from "obuild/config";

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { CodeSplittingOptions } from "rolldown";
import { glob } from "tinyglobby";

const isStub = process.argv.includes("--stub");

// Optional dependencies imported on demand from the user project (see `src/utils/dep.ts`)
const optionalDeps = [
  "@vercel/queue",
  "dotenv",
  "giget",
  "jiti",
  "rolldown",
  "rollup",
  "vite",
  "xml2js",
  "zephyr-agent",
];

// Optional dependencies of bundled libraries, replaced by an on demand import (see `src/shims/`)
const shimmedDeps = ["dotenv", "giget", "jiti"];

const pkg = await import("./package.json", { with: { type: "json" } }).then((r) => r.default || r);

export default defineBuildConfig({
  entries: [
    {
      type: "bundle",
      input: [
        "src/builder.ts",
        "src/cli/index.ts",
        "src/types/index.ts",
        "src/presets/cloudflare/types.ts",
        "src/vite.ts",
      ],
      license: { gzip: true },
    },
    {
      // Every runtime file stays an entry (build code references them by path). Bundling them
      // together inlines dependencies into chunks shared across all runtime entries.
      // Kept separate from the main bundle so runtime chunks never pull in build-time code.
      type: "bundle",
      input: await glob(["src/runtime/**/*.ts", "src/presets/*/runtime/**/*.ts"]),
      license: { gzip: true },
      dts: { entry: "src/runtime/**/*.ts", generator: "oxc" },
      rolldown: {
        // Keep side-effect imports of virtual modules (e.g. `import "#nitro/virtual/polyfills"`)
        treeshake: {
          moduleSideEffects: (id, external) => (external ? id.startsWith("#") : undefined),
        },
        plugins: [
          {
            name: "nitro:runtime-chunks",
            outputOptions: (o) => ({
              ...o,
              chunkFileNames: (chunk) =>
                libChunkFileName(chunk, "runtime/_libs") || "runtime/_chunks/[name].mjs",
            }),
            // Polyfills are always imported first in source, but rolldown hoists chunk and other
            // external imports above them. Move them back so they still evaluate first.
            renderChunk(code) {
              const polyfillsImport = `import "#nitro/virtual/polyfills";\n`;
              if (code.includes(polyfillsImport)) {
                return polyfillsImport + code.replace(polyfillsImport, "");
              }
            },
          },
        ],
      },
    },
    {
      // Plain JS runtime files loaded as-is (dev worker and entries)
      type: "transform",
      input: "src/runtime/",
      outDir: "dist/runtime",
      filter: (id) => id.endsWith(".mjs"),
    },
    {
      type: "transform",
      input: "src/presets/",
      outDir: "dist/presets",
      filter: (id) => id.includes("runtime/") && id.endsWith(".mjs"),
      dts: false,
    },
  ],
  hooks: {
    rolldownConfig(config) {
      config.platform = "node";

      config.resolve ??= {};
      config.resolve.alias ??= {};
      Object.assign(
        config.resolve.alias,
        {
          "node-fetch-native/proxy": "node-fetch-native/native",
          "node-fetch-native": "node-fetch-native/native",
        },
        Object.fromEntries(
          shimmedDeps.map((dep) => [
            dep,
            fileURLToPath(new URL(`src/shims/${dep}.ts`, import.meta.url)),
          ])
        )
      );

      config.external ??= [];
      (config.external as (string | RegExp)[]).push(
        "nitro",
        ...Object.keys(pkg.exports || {}).map((key) => key.replace(/^./, "nitro")),
        ...Object.keys(pkg.dependencies),
        ...optionalDeps.filter((dep) => !shimmedDeps.includes(dep)),
        "typescript",
        "firebase-functions",
        "@scalar/api-reference",
        "cloudflare:workers",
        "@cloudflare/workers-types",
        // unplugin deps
        "@rspack/core",
        "@farmfe/core",
        "webpack",
        "unloader",
        // CommonJS `.d.ts` modules that rolldown-plugin-dts cannot bundle
        "webpack-virtual-modules",
        /^zod(\/|$)/
      );
    },
    rolldownOutput(config) {
      (config.codeSplitting as CodeSplittingOptions).groups?.unshift(
        {
          test: /src[/\\]build[/\\](plugins|virtual|\w+\.ts)/,
          name: "_build/common",
        },
        { test: /src[/\\](utils)[/\\]/, name: "_chunks/utils" }
      );
      config.chunkFileNames = (chunk) => {
        if (chunk.name.startsWith("_")) {
          return `[name].mjs`;
        }
        if (chunk.name === "rolldown-runtime") {
          return `_common.mjs`;
        }
        const libChunk = libChunkFileName(chunk, "_libs");
        if (libChunk) {
          return libChunk;
        }
        if (chunk.moduleIds.every((id) => /src[/\\]cli[/\\]/.test(id))) {
          return `cli/_chunks/[name].mjs`;
        }
        if (chunk.moduleIds.every((id) => /build[/\\]vite[/\\]/.test(id))) {
          return `_build/vite.[name].mjs`;
        }
        if (chunk.moduleIds.every((id) => /build[/\\]rolldown[/\\]/.test(id))) {
          return `_build/rolldown.mjs`;
        }
        if (chunk.moduleIds.every((id) => /build[/\\]rollup[/\\]|build[/\\]plugins/.test(id))) {
          return `_build/rollup.mjs`;
        }
        if (chunk.moduleIds.every((id) => /src[/\\]dev[/\\]|src[/\\]runtime/.test(id))) {
          return `_dev.mjs`;
        }
        if (chunk.moduleIds.every((id) => /src[/\\]presets/.test(id))) {
          return `_presets.mjs`;
        }
        if (
          chunk.moduleIds.every((id) => /src[/\\]build[/\\]|src[/\\]presets|src[/\\]utils/.test(id))
        ) {
          return `_build/shared.mjs`;
        }
        if (chunk.moduleIds.every((id) => /src[/\\](runner|dev|runtime)/.test(id))) {
          return `_chunks/dev.mjs`;
        }
        return "_chunks/nitro.mjs";
      };
    },
    async end() {
      if (isStub) {
        return;
      }

      // Bundle docs
      const { exportSource } = await import("mdzilla");
      await exportSource("./docs", "./dist/docs", {
        title: "Nitro Documentation",
        filter: (e: { entry: { path: string } }) => !e.entry.path.startsWith("/blog"),
      });

      // Vite types
      await writeFile(
        "dist/vite.d.mts",
        `import "vite/client";\nimport "nitro/vite/types";\n${await readFile("dist/vite.d.mts", "utf8")}`
      );
    },
  },
});

function libChunkFileName(chunk: { moduleIds: string[] }, dir: string): string | undefined {
  const pkgRe = /.*[/\\](?:node_modules|shims)[/\\](?<package>@[^/\\]+[/\\][^/\\]+|[^/\\]+)/;
  if (!chunk.moduleIds.every((id) => pkgRe.test(id))) {
    return;
  }
  const pkgNames = [
    ...new Set(
      chunk.moduleIds
        .map((id) => id.match(pkgRe)?.groups?.package)
        .filter(Boolean)
        .map((name) => name!.split(/[/\\]/).pop()!)
        .filter(Boolean)
    ),
  ].sort((a, b) => a.length - b.length);
  let chunkName = "";
  for (const name of pkgNames) {
    const separator = chunkName ? "+" : "";
    if ((chunkName + separator + name).length > 30) {
      break;
    }
    chunkName += separator + name;
  }
  return `${dir}/${chunkName || "_"}.mjs`;
}
