import "#nitro/virtual/polyfills";
import { useNitroApp } from "nitro/app";
import { azureResponseBody, getAzureParsedCookiesFromHeaders } from "./_utils.ts";

import type { HttpRequest, HttpResponse, HttpResponseSimple } from "@azure/functions";

const nitroApp = useNitroApp();

/** `new Request()` requires an absolute URL; Azure SWA only provides relative paths. */
export function resolveAzureSwaRequestUrl(req: HttpRequest): string {
  if (req.headers["x-ms-original-url"]) {
    return req.headers["x-ms-original-url"];
  }
  // /api/* calls never hit the SWA proxy, so we reconstitute the URL.
  return new URL("/api/" + (req.params.url || ""), "http://nitro.local").href;
}

export async function handle(context: { res: HttpResponse }, req: HttpRequest) {
  const request = new Request(resolveAzureSwaRequestUrl(req), {
    method: req.method || undefined,
    // https://github.com/Azure/azure-functions-nodejs-worker/issues/294
    // https://github.com/Azure/azure-functions-host/issues/293
    body: req.bufferBody ?? req.rawBody,
  });

  const response = await nitroApp.fetch(request);
  const body = await azureResponseBody(response);

  // (v3 - current) https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node?tabs=typescript%2Cwindows%2Cazure-cli&pivots=nodejs-model-v3#http-response
  // (v4) https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node?tabs=typescript%2Cwindows%2Cazure-cli&pivots=nodejs-model-v4#http-response
  context.res = {
    status: response.status,
    body,
    cookies: getAzureParsedCookiesFromHeaders(response.headers),
    headers: Object.fromEntries(
      [...response.headers.entries()].filter(([key]) => key !== "set-cookie")
    ),
  } satisfies HttpResponseSimple;
}
