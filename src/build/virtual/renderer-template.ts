import type { Nitro } from "nitro/types";
import { readFile } from "node:fs/promises";
import { hasTemplateSyntax, compileTemplateToString, RENDER_CONTEXT_KEYS } from "rendu";

export default function rendererTemplate(nitro: Nitro) {
  return {
    id: "#nitro/virtual/renderer-template",
    template: async () => {
      const template = nitro.options.renderer?.template;
      if (typeof template !== "string") {
        // No template
        return /* js */ `
            export const rendererTemplate = () => '<!-- renderer.template is not set -->';
            export const rendererTemplateFile = undefined;
            export const isStaticTemplate = true;`;
      }
      if (nitro.options.dev) {
        // Development
        return /* js */ `
            import { readFile } from 'node:fs/promises';
            export const rendererTemplate = () => readFile(${JSON.stringify(template)}, "utf8");
            export const rendererTemplateFile = ${JSON.stringify(template)};
            export const isStaticTemplate = ${JSON.stringify(nitro.options.renderer?.static)};
            `;
      } else {
        // Production
        const html = await readFile(template, "utf8");
        const isStatic = nitro.options.renderer?.static ?? !hasTemplateSyntax(html);
        if (isStatic) {
          return /* js */ `
              import { HTTPResponse } from "h3";
              export const rendererTemplate = () => new HTTPResponse(${JSON.stringify(html)}, { headers: { "content-type": "text/html; charset=utf-8" } });
            `;
        } else {
          const template = compileTemplateToString(html, {
            contextKeys: [...RENDER_CONTEXT_KEYS],
          });
          return /* js */ `
            import { renderToResponse } from 'rendu'
            import { serverFetch } from 'nitro/app'
            const template = ${template};
            export const rendererTemplate = (request) => renderToResponse(template, { request, context: { serverFetch } })
            `;
        }
      }
    },
  };
}
