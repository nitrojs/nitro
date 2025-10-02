import type { Nitro } from "nitro/types";
import { virtual } from "./virtual";
import { readFile } from "node:fs/promises";

export function indexHTML(nitro: Nitro) {
  return virtual(
    {
      "#nitro-internal-virtual/index-html": async () => {
        if (typeof nitro.options.indexHTML === "string") {
          return nitro.options.dev
            ? /* js */ `import fs from 'node:fs';export const indexHTML = () => fs.createReadStream(${JSON.stringify(nitro.options.indexHTML!)}, "utf8")`
            : /* js */ `export const indexHTML = () => ${JSON.stringify(await readFile(nitro.options.indexHTML, "utf8"))}`;
        }
        if (typeof nitro.options.indexHTML === "function") {
          return /* js */ `export const indexHTML = () => ${JSON.stringify(await nitro.options.indexHTML())}`;
        }
        return /* js */ `export const indexHTML = () => '<!-- 404 -->'`;
      },
    },
    nitro.vfs
  );
}
