import { glob, rm, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "pathe";
import { normalize } from "pathe";
import { defineBuildConfig } from "unbuild";

const srcDir = fileURLToPath(new URL("src", import.meta.url));

export const subpaths = ["config", "presets", "runtime", "meta", "types"];

export default defineBuildConfig({
  declaration: true,
  name: "nitro",
  entries: [
    { input: "src/cli/index.ts" },
    { input: "src/config/index.ts" },
    { input: "src/core/index.ts" },
    { input: "src/meta/index.ts" },
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
    "nitro/runtime/meta",
    ...subpaths.map((subpath) => `nitro/${subpath}`),
    "firebase-functions",
    "@scalar/api-reference",
  ],
  stubOptions: {
    jiti: {
      alias: {
        nitro: "nitro",
        "nitro/meta": resolve(srcDir, "../meta.ts"),
        "nitro/runtime/meta": resolve(srcDir, "../lib/runtime-meta.mjs"),
        ...Object.fromEntries(
          subpaths.map((subpath) => [
            `nitro/${subpath}`,
            resolve(srcDir, `${subpath}/index.ts`),
          ])
        ),
      },
    },
  },
  rollup: {
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
