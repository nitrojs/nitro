import { resolve } from "pathe";
import { writeFile } from "../utils";
import { defineNitroPreset } from "../preset";
import type { Nitro } from "../types";

export const cloudflare = defineNitroPreset({
  extends: "base-worker",
  entry: "#internal/nitro/entries/cloudflare",
  exportConditions: ["workerd"],
  commands: {
    preview: "npx wrangler dev ./server/index.mjs --site ./public --local",
    deploy: "npx wrangler deploy",
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
    "rollup:before"(nitro) {
      if (nitro.options.experimental?.wasm) {
        if (nitro.options.experimental.wasm === true) {
          nitro.options.experimental.wasm = {};
        }
        // Cloudflare Workers requires WASM to be directly imported
        // https://community.cloudflare.com/t/fixed-cloudflare-workers-slow-with-moderate-sized-webassembly-bindings/184668/3
        nitro.options.experimental.wasm.directImport = true;
      }
    },
  },
});
