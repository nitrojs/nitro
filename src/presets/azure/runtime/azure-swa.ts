import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitropack/runtime";
import {
  getAzureParsedCookiesFromHeaders,
  normalizeLambdaOutgoingHeaders,
} from "nitropack/runtime/internal";

import type { HttpRequest, HttpResponse } from "@azure/functions";
import { parseURL } from "ufo";

const nitroApp = useNitroApp();

export async function handle(context: { res: HttpResponse }, req: HttpRequest) {
  let url: string;
  if (req.headers["x-ms-original-url"]) {
    // This URL has been proxied as there was no static file matching it.
    const parsedURL = parseURL(req.headers["x-ms-original-url"]);
    url = parsedURL.pathname + parsedURL.search;
  } else {
    // Because Azure SWA handles /api/* calls differently they
    // never hit the proxy and we have to reconstitute the URL.
    url = "/api/" + (req.params.url || "");
  }

  const { body, status, headers } = await nitroApp.localCall({
    url,
    headers: req.headers,
    method: req.method || undefined,
    // https://github.com/Azure/azure-functions-nodejs-worker/issues/294
    // https://github.com/Azure/azure-functions-host/issues/293
    body: req.bufferBody ?? req.rawBody,
  });

  // (v3 - current) https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node?tabs=typescript%2Cwindows%2Cazure-cli&pivots=nodejs-model-v3#http-response
  // (v4) https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node?tabs=typescript%2Cwindows%2Cazure-cli&pivots=nodejs-model-v4#http-response
  context.res = {
    status,
    cookies: getAzureParsedCookiesFromHeaders(headers),
    headers: normalizeLambdaOutgoingHeaders(headers, true),
    body,
  };
}
