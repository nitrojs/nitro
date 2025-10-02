import type { Nitro } from "nitro/types";
import { virtual } from "./virtual";
import { readFile } from "node:fs/promises";

export function indexHTML(nitro: Nitro) {
  return virtual(
    {
      "#nitro-internal-virtual/index-html": async () => {
        if (typeof nitro.options.indexHTML !== "string") {
          return `export const indexHTML = () => '<!-- no index.html -->'`;
        }
        if (nitro.options.dev) {
          return `import fs from 'node:fs';export const indexHTML = () => fs.createReadStream(${JSON.stringify(nitro.options.indexHTML)}, "utf8")`;
        }
        const html = await readFile(nitro.options.indexHTML, "utf8");
        return `export const indexHTML = () => ${JSON.stringify(html)}`;
      },
    },
    nitro.vfs
  );
}
