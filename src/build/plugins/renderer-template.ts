import type { Nitro } from "nitro/types";
import { virtual } from "./virtual.ts";
import { readFile } from "node:fs/promises";
import {
  hasTemplateSyntax,
  compileTemplateToString,
  RENDER_CONTEXT_KEYS,
} from "rendu";

export function rendererTemplate(nitro: Nitro) {
  return virtual(
    {
      "#nitro-internal-virtual/renderer-template": async () => {
        if (typeof nitro.options.renderer?.template !== "string") {
          // No template
          return `export const rendererTemplate = () => '<!-- renderer.template is not set -->'; export const rendererTemplateFile = undefined;`;
        }
        if (nitro.options.dev) {
          // Development
          return `import { readFile } from 'node:fs/promises';export const rendererTemplate = () => readFile(${JSON.stringify(nitro.options.renderer?.template)}, "utf8"); export const rendererTemplateFile = ${JSON.stringify(
            nitro.options.renderer?.template
          )};`;
        } else {
          // Production
          const html = await readFile(nitro.options.renderer?.template, "utf8");
          if (hasTemplateSyntax(html)) {
            const template = compileTemplateToString(html, {
              contextKeys: [...RENDER_CONTEXT_KEYS],
            });
            return /* js */ `
            import { renderToResponse } from 'rendu'
            const template = ${template};
            export const rendererTemplate = (request) => renderToResponse(template, { request })
            `;
          } else {
            return /* js */ `
              import { HTTPResponse } from "h3";
              export const rendererTemplate = () => new HTTPResponse(${JSON.stringify(html)}, { headers: { "content-type": "text/html; charset=utf-8" } });
            `;
          }
        }
      },
    },
    nitro.vfs
  );
}
