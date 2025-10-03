import type { Nitro } from "nitro/types";
import { virtual } from "./virtual";
import { readFile } from "node:fs/promises";

export function rendererTemplate(nitro: Nitro) {
  return virtual(
    {
      "#nitro-internal-virtual/renderer-template": async () => {
        if (typeof nitro.options.renderer?.template !== "string") {
          // No template
          return `export const rendererTemplate = () => '<!-- renderer.template is not set -->'`;
        }
        if (nitro.options.dev) {
          // Development
          return `import fs from 'node:fs';export const rendererTemplate = () => fs.createReadStream(${JSON.stringify(nitro.options.renderer?.template)}, "utf8")`;
        } else {
          // Production
          const html = await readFile(nitro.options.renderer?.template, "utf8");
          return `export const rendererTemplate = () => ${JSON.stringify(html)}`;
        }
      },
    },
    nitro.vfs
  );
}
