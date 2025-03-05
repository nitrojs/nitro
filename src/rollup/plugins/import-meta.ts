import type { Nitro } from "nitro/types";
import type { Plugin } from "rollup";

export const ImportMetaRe = /import\.meta|globalThis._importMeta_/;

export function importMeta(nitro: Nitro): Plugin {
  return {
    name: "import-meta",
    renderChunk(code, chunk) {
      const isEntry = chunk.isEntry;
      if (
        !isEntry &&
        (!ImportMetaRe.test(code) || code.includes("ROLLUP_NO_REPLACE"))
      ) {
        return;
      }
      const url =
        nitro.options.node && isEntry && !code.includes("ROLLUP_NO_REPLACE")
          ? "_import_meta_url_"
          : '"file:///_entry.js"';
      const envImport = nitro.options.node
        ? "import process from 'node:process';"
        : "";
      const env = nitro.options.node ? "process.env" : "{}";
      const ref = "globalThis._importMeta_";
      const stub = `{url:${url},env:${env}}`;
      const stubInit = isEntry ? `${ref}=${stub};` : `${ref}=${ref}||${stub};`;

      return {
        code: envImport + stubInit + code,
        map: null,
      };
    },
  };
}
