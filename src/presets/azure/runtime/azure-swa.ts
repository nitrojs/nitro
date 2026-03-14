import "#nitro/virtual/polyfills";
import { parseURL } from "ufo";
import { useNitroApp } from "nitro/app";
import { getAzureParsedCookiesFromHeaders } from "./_utils.ts";

import type { HttpRequest, HttpResponse, HttpResponseSimple } from "@azure/functions";

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

  const request = new Request(url, {
    method: req.method || undefined,
    // https://github.com/Azure/azure-functions-nodejs-worker/issues/294
    // https://github.com/Azure/azure-functions-host/issues/293
    body: req.bufferBody ?? req.rawBody,
  });

  const response = await nitroApp.fetch(request);

  // (v3 - current) https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node?tabs=typescript%2Cwindows%2Cazure-cli&pivots=nodejs-model-v3#http-response
  // (v4) https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node?tabs=typescript%2Cwindows%2Cazure-cli&pivots=nodejs-model-v4#http-response
  context.res = {
    status: response.status,
    body: response.body,
    cookies: getAzureParsedCookiesFromHeaders(response.headers),
    headers: Object.fromEntries(
      [...response.headers.entries()].filter(([key]) => key !== "set-cookie")
    ),
  } satisfies HttpResponseSimple;
}
