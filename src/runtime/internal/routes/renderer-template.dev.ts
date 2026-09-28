import type { H3Event } from "h3";
import { serverFetch } from "../app.ts";
import {
  rendererTemplate,
  rendererTemplateFile,
  isStaticTemplate,
} from "#nitro/virtual/renderer-template";
import { HTTPResponse } from "h3";
import { hasTemplateSyntax, renderToResponse, compileTemplate } from "rendu";

export default async function renderIndexHTML(event: H3Event): Promise<HTTPResponse | Response> {
  const html = await rendererTemplate(event.req as Request);

  const isStatic = isStaticTemplate ?? !hasTemplateSyntax(html);
  if (isStatic) {
    return new HTTPResponse(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const template = compileTemplate(html, { filename: rendererTemplateFile });
  return renderToResponse(template, {
    request: event.req as Request,
    context: { serverFetch },
  });
}
