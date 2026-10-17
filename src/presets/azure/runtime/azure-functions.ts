import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitropack/runtime";
import {
  getAzureParsedCookiesFromHeaders,
  normalizeLambdaOutgoingHeaders,
} from "nitropack/runtime/internal";

import type { HttpRequest, HttpResponse } from "@azure/functions";

const nitroApp = useNitroApp();

export async function handle(context: { res: HttpResponse }, req: HttpRequest) {
  let url = "/" + (req.params.url || "");

  if (req.url && req.url.includes("?")) {
    url += req.url.slice(req.url.indexOf("?"));
  }

  const { body, status, statusText, headers } = await nitroApp.localCall({
    url,
    headers: req.headers,
    method: req.method || undefined,
    // https://github.com/Azure/azure-functions-host/issues/293
    body: req.rawBody,
  });

  context.res = {
    status,
    // cookies https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node?tabs=typescript%2Cwindows%2Cazure-cli&pivots=nodejs-model-v4#http-response
    cookies: getAzureParsedCookiesFromHeaders(headers),
    headers: normalizeLambdaOutgoingHeaders(headers, true),
    body: body ?? statusText,
  };
}
