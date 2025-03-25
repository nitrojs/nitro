import { glob, rm, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "pathe";
import { normalize } from "pathe";
import { defineBuildConfig } from "unbuild";

const srcDir = fileURLToPath(new URL("src", import.meta.url));
const libDir = fileURLToPath(new URL("lib", import.meta.url));

export const distSubpaths = ["presets", "runtime", "types"];

export const libSubpaths = ["config", "meta", "runtime/meta"];

// prettier-ignore
const inlineDependencies = [
  "@babel/parser","@jridgewell/sourcemap-codec","@parcel/watcher","@parcel/watcher-wasm","@rollup/plugin-alias","@rollup/plugin-commonjs",
  "@rollup/plugin-inject","@rollup/plugin-json","@rollup/plugin-node-resolve","@rollup/plugin-replace","@rollup/pluginutils",
  "acorn","braces","c12","c12/update","chokidar","citty","clipboardy","commondir","debug","deepmerge","define-lazy-prop",
  "depd","destroy","detect-libc","dot-prop","dotenv","duplexer","ee-first","encodeurl","escape-html","escape-string-regexp",
  "estree","estree-walker","etag","exsolve","fdir","fill-range","fresh","function-bind","get-port-please","giget","gzip-size",
  "hasown","http-errors","http-shutdown","httpxy","inherits","is-core-module","is-docker","is-extglob","is-glob","is-module",
  "is-number","is-reference","is-wsl","js-tokens","knitwork","listhen","listhen/cli","local-pkg","magic-string","magicast",
  "micromatch","mime","ms","napi-wasm","node-fetch-native/proxy","node-forge","nypm","on-finished","open","parseurl","path-parse",
  "perfect-debounce","picomatch","picomatch/lib/utils","pretty-bytes","quansync/macro","range-parser","rc9","readdirp","resolve",
  "rollup-plugin-visualizer","semver","send","serve-placeholder","serve-static","setprototypeof","source-map-js","statuses",
  "strip-literal","tinyexec","tinyglobby","to-regex-range","toidentifier","ultrahtml","unimport","unimport/unplugin",
  "unplugin-utils","untun","untyped","unwasm/plugin","uqr"
]

export const stubAlias = {
  nitro: resolve(srcDir, "index.ts"),
  ...Object.fromEntries(
    distSubpaths.map((subpath) => [
      `nitro/${subpath}`,
      resolve(srcDir, `${subpath}/index.ts`),
    ])
  ),
  ...Object.fromEntries(
    libSubpaths.map((subpath) => [
      `nitro/${subpath}`,
      resolve(libDir, `${subpath.replace("/", "-")}.mjs`),
    ])
  ),
};

export default defineBuildConfig({
  declaration: true,
  name: "nitro",
  entries: [
    { input: "src/cli/index.ts" },
    { input: "src/index.ts" },
    { input: "src/types/index.ts" },
    { input: "src/runtime/", outDir: "dist/runtime", format: "esm" },
    { input: "src/presets/", outDir: "dist/presets", format: "esm" },
  ],
  hooks: {
    async "build:done"(ctx) {
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
    "nitro",
    "typescript",
    ...[...distSubpaths, ...libSubpaths].map((subpath) => `nitro/${subpath}`),
    "firebase-functions",
    "@scalar/api-reference",
  ],
  stubOptions: {
    jiti: {
      alias: stubAlias,
    },
  },
  rollup: {
    cjsBridge: true,
    inlineDependencies,
    output: {
      chunkFileNames(chunk: any) {
        const id = normalize(chunk.moduleIds.at(-1));
        if (id.includes("/src/cli/")) {
          return "cli/[name].mjs";
        }
        return "_chunks/[name].mjs";
      },
    },
  },
});
