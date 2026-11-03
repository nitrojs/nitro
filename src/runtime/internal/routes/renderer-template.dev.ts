import type { H3Event } from "h3";
import { serverFetch } from "../app.ts";
import {
  rendererTemplate,
  rendererTemplateFile,
  isStaticTemplate,
} from "#nitro/virtual/renderer-template";
import { HTTPResponse } from "h3";
import {
  hasTemplateSyntax,
  renderToResponse,
  compileTemplate,
  compileTemplateToString,
} from "rendu";

export default async function renderIndexHTML(event: H3Event): Promise<HTTPResponse | Response> {
  let html = await rendererTemplate(event.req as Request);

  if ((globalThis as any).__transform_html__) {
    html = await (globalThis as any).__transform_html__(html);
  }

  const isStatic = isStaticTemplate ?? !hasTemplateSyntax(html);
  if (isStatic) {
    return new HTTPResponse(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const template = compileDevTemplate(html);
  return renderToResponse(template, {
    request: event.req as Request,
    context: { serverFetch },
  });
}

function compileDevTemplate(html: string) {
  // workerd disallows code generation from strings: use the eval binding of the env-runner wrapper
  const unsafeEval = (globalThis as any).__ENV_RUNNER_UNSAFE_EVAL__;
  if (!unsafeEval) {
    return compileTemplate(html, { filename: rendererTemplateFile });
  }
  const sourceURL = rendererTemplateFile ? `//# sourceURL=${rendererTemplateFile}\n` : "";
  const body = compileTemplateToString(html, {}, false) + sourceURL;
  try {
    return unsafeEval.newAsyncFunction(body, "renderTemplate", "__context__");
  } catch (error) {
    throw new SyntaxError(`Template syntax error: ${(error as Error).message}`, { cause: error });
  }
}
