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
            export async function rendererTemplate() {
              try {
                return await readFile(${JSON.stringify(template)}, "utf8");
              } catch (error) {
                // The runner may lack fs access (e.g. workerd): ask the host (set by the dev entry)
                if (!globalThis.__nitro_renderer_template__) throw error;
                return globalThis.__nitro_renderer_template__();
              }
            }
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
            import { fetch, serverFetch } from 'nitro/app'
            ${nitro.options.builder === "vite" ? `import { fetchViteEnv } from "nitro/vite/runtime"` : ""}
            const context = { fetch, serverFetch${nitro.options.builder === "vite" ? ", fetchViteEnv" : ""} }
            const template = ${template};
            export const rendererTemplate = (request) => renderToResponse(template, { request, context })
            `;
        }
      }
    },
  };
}
