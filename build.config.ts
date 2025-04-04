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
  "@rollup/plugin-alias","@rollup/plugin-commonjs", "@rollup/plugin-inject","@rollup/plugin-json", "@rollup/plugin-node-resolve","@rollup/plugin-replace","@rollup/pluginutils", "unplugin-utils", "rollup-plugin-visualizer",
  "untun","untyped","unwasm","uqr", "unimport", "citty", "nypm", "c12", "listhen", "rc9", "node-fetch-native", "perfect-debounce", "knitwork", "magicast", "get-port-please","giget", "httpxy", "exsolve",
  "tinyexec","tinyglobby",
  "is-core-module","is-docker","is-extglob","is-glob","is-module", "is-number","is-reference", "is-wsl",
  "http-errors","http-shutdown", "send","serve-placeholder","serve-static" ,"on-finished", "destroy", "mime", "statuses", "etag", "duplexer",
  "acorn", "estree", "estree-walker", "@babel/parser", "magic-string", "strip-literal",
  "chokidar", "@parcel/watcher","@parcel/watcher-wasm",
  "hasown","inherits", "setprototypeof", "js-tokens", "function-bind", "fill-range",
  "encodeurl","escape-html","escape-string-regexp",
  "source-map-js", "@jridgewell/sourcemap-codec",
  "braces", "micromatch", "picomatch", "fdir", "readdirp", "path-parse", "resolve",
  "pretty-bytes", "ms",
  "local-pkg", "semver",
  "detect-libc", "napi-wasm",
  "clipboardy","commondir","debug","deepmerge","define-lazy-prop",
  "depd", "dot-prop","dotenv","ee-first",
  "fresh","gzip-size",
  "node-forge","open","parseurl",
  "quansync","range-parser",
  "to-regex-range","toidentifier","ultrahtml",
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
