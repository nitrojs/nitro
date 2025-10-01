import type { Nitro } from "nitro/types";
import { virtual } from "./virtual";
import { readFile } from "node:fs/promises";

export function indexHTML(nitro: Nitro) {
  return virtual(
    {
      "#nitro-internal-virtual/index-html": async () => {
        const contents = await readFile(nitro.options.indexHTML!, "utf8");
        if (nitro.options.dev) {
          return /* js */ `import { readFile } from 'node:fs/promises';export const indexHTML = () => readFile(${JSON.stringify(nitro.options.indexHTML!)}, "utf8");
          `;
        } else {
          return /* js */ `export const indexHTML = () => ${JSON.stringify(contents)}`;
        }
      },
    },
    nitro.vfs
  );
}
