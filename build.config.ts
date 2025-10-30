import { glob, rm, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "pathe";
import { normalize } from "pathe";
import { defineBuildConfig } from "unbuild";

import { resolveModulePath } from "exsolve";
import { traceNodeModules } from "nf3";
import { parseNodeModulePath } from "mlly";

const pkg = await import("./package.json").then((r) => r.default || r);

const srcDir = fileURLToPath(new URL("src", import.meta.url));
const libDir = fileURLToPath(new URL("lib", import.meta.url));

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

export const stubAlias = {
  nitro: resolve(libDir, "index.mjs"),
  ...Object.fromEntries(
    distSubpaths.map((subpath) => [
      `nitro/${subpath}`,
      resolve(
        srcDir,
        subpath === "builder" ? "builder.ts" : `${subpath}/index.ts`
      ),
    ])
  ),
  ...Object.fromEntries(
    libSubpaths.map((subpath) => [
      `nitro/${subpath}`,
      resolve(libDir, `${subpath}.mjs`),
    ])
  ),
};

export default defineBuildConfig({
  declaration: true,
  name: "nitro",
  entries: [
    { input: "src/cli/index.ts" },
    { input: "src/builder.ts" },
    { input: "src/vite.ts" },
    { input: "src/types/index.ts" },
    { input: "src/runtime/", outDir: "dist/runtime", format: "esm" },
    {
      input: "src/presets/",
      outDir: "dist/presets",
      format: "esm",
      pattern: "**/runtime/**",
    },
  ],
  hooks: {
    async "build:done"(ctx) {
      // Trace bundled dependencies
      await traceNodeModules(
        tracePkgs.map((pkg) => resolveModulePath(pkg)),
        {}
      );
      for (const dep of Object.keys(pkg.dependencies)) {
        await rm(`dist/node_modules/${dep}`, { recursive: true, force: true });
      }

      // Remove extra d.ts files
      for await (const file of glob(resolve(ctx.options.outDir, "**/*.d.ts"))) {
        if (file.includes("runtime") || file.includes("presets")) {
          const dtsContents = (await readFile(file, "utf8")).replaceAll(
            / from "\.\/(.+)";$/gm,
            (_, relativePath) => ` from "./${relativePath}.mjs";`
          );
          await writeFile(file.replace(/\.d.ts$/, ".d.mts"), dtsContents);
        }
        await rm(file);
      }
    },
  },
  externals: [
    "typescript",
    "nitro",
    ...[...distSubpaths, ...libSubpaths].map((subpath) => `nitro/${subpath}`),
    ...tracePkgs,
    "firebase-functions",
    "@scalar/api-reference",
    "get-port-please", // internal type only
    "@cloudflare/workers-types", // issues with rollup-plugin-dts
  ],
  stubOptions: {
    jiti: {
      alias: stubAlias,
    },
  },
  rollup: {
    inlineDependencies: true,
    output: {
      manualChunks(id: string) {
        if (id.includes("node_modules")) {
          const pkg = parseNodeModulePath(id);
          if (pkg?.name) {
            return `_deps/${pkg.name}`;
          }
        }
        if (id.includes("src/presets/")) {
          const presetDir = /\/src\/presets\/([^/.]+)/.exec(id);
          return `_presets/${presetDir?.[1] || "_common"}`;
        }
        // if (id.includes("src/build/")) {
        //   const dir = /\/src\/build\/([^/.]+)/.exec(id);
        //   return `_build/${dir?.[1] || "_common"}`;
        // }
      },
      chunkFileNames(chunk: any) {
        const tailId = normalize(chunk.moduleIds.at(-1));
        if (tailId.includes("/src/cli/")) {
          return "_cli/[name].mjs";
        }
        if (tailId.includes("/src/build/")) {
          if (
            chunk.moduleIds.every((id: string) => id.includes("src/build/vite"))
          ) {
            return "_build/vite.mjs";
          }
          return "_build/[name].mjs";
        }
        return "_chunks/[name].mjs";
      },
    },
  },
});
