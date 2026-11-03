import type { Nitro } from "nitro/types";
import { readFile } from "node:fs/promises";
import {
  compileTemplate,
  compileTemplateToString,
  hasTemplateSyntax,
  RENDER_CONTEXT_KEYS,
} from "rendu";
import { prettyPath } from "../../utils/fs.ts";

const SSR_OUTLET = "<!--ssr-outlet-->";

export default function rendererTemplate(nitro: Nitro) {
  return {
    id: "#nitro/virtual/renderer-template",
    template: async () => {
      try {
        return await renderTemplateModule(nitro);
      } catch (error) {
        if (!nitro.options.dev) {
          throw error;
        }
        // Only the page fails in development, other routes keep working
        const message = error instanceof Error ? error.message : String(error);
        return /* js */ `export const rendererTemplate = () => { throw new Error(${JSON.stringify(message)}); };`;
      }
    },
    // Rebuilt by the bundler when the template changes (the Vite dev server transforms it again)
    watchFiles: () => {
      const template = nitro.options.renderer?.template;
      return nitro.options.dev && nitro.options.builder !== "vite" && typeof template === "string"
        ? [template]
        : [];
    },
  };
}

async function renderTemplateModule(nitro: Nitro): Promise<string> {
  let html = await readPageHTML(nitro);
  if (html === undefined) {
    return /* js */ `
import { HTTPResponse } from "h3";
export const rendererTemplate = () => new HTTPResponse("<!-- renderer.template is not set -->", { headers: { "content-type": "text/html; charset=utf-8" } });
`;
  }

  const fetchService = nitro._pageTemplate?.fetchService;
  if (fetchService && nitro.options.renderer?.static !== true && html.includes(SSR_OUTLET)) {
    html = html.replace(SSR_OUTLET, `{{{ __nitro_fetchService__("ssr", $REQUEST) }}}`);
  }

  const isStatic = nitro.options.renderer?.static ?? !hasTemplateSyntax(html);
  if (isStatic) {
    return /* js */ `
import { HTTPResponse } from "h3";
export const rendererTemplate = () => new HTTPResponse(${JSON.stringify(html)}, { headers: { "content-type": "text/html; charset=utf-8" } });
`;
  }

  const contextKeys = [...RENDER_CONTEXT_KEYS];
  try {
    compileTemplate(html, { contextKeys });
  } catch (error) {
    const file = nitro.options.renderer?.template;
    throw new Error(
      `Invalid renderer template${file ? ` (\`${prettyPath(file, false)}\`)` : ""}: ${(error as Error).message}`,
      { cause: error }
    );
  }
  const template = compileTemplateToString(html, { contextKeys });
  const contextImports = nitro._pageTemplate?.context || [];
  return /* js */ `
import { renderToResponse } from "#nitro/runtime/rendu";
import { fetch, serverFetch } from "nitro/app";
${contextImports.map((i) => `import { ${i.name} } from ${JSON.stringify(i.from)};`).join("\n")}
${fetchService ? `import { ${fetchService.name} as __nitro_fetchService__ } from ${JSON.stringify(fetchService.from)};` : ""}
const context = { fetch, serverFetch${contextImports.map((i) => `, ${i.name}`).join("")} };
const template = ${template};
export const rendererTemplate = (request) => renderToResponse(template, { request, context });
`;
}

async function readPageHTML(nitro: Nitro): Promise<string | undefined> {
  if (nitro._pageTemplate?.html) {
    return nitro._pageTemplate.html();
  }
  const template = nitro.options.renderer?.template;
  if (typeof template === "string") {
    return readFile(template, "utf8");
  }
}
