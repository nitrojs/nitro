import { readFile } from "node:fs/promises";
import { resolve } from "pathe";
import { writeFile } from "../utils";
import { defineNitroPreset } from "../preset";
import type { Nitro } from "../types";

export const cloudflareModule = defineNitroPreset({
  extends: "base-worker",
  entry: "#internal/nitro/entries/cloudflare-module",
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
});
