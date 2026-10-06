import "#nitro/virtual/polyfills";
import { parseURL } from "ufo";
import { useNitroApp } from "nitro/app";
import { getAzureParsedCookiesFromHeaders, resolveBaseUrl } from "./_utils.ts";

import type { Cookie } from "@azure/functions";

// Legacy Azure Functions v3 programming model (`function.json`)
// https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node?pivots=nodejs-model-v3

interface HttpRequestV3 {
  method: string | null;
  headers: Record<string, string>;
  params: Record<string, string>;
  bufferBody?: Uint8Array<ArrayBuffer>;
  rawBody?: string;
}

interface HttpResponseV3 {
  status?: number;
  body?: Buffer;
  headers?: Record<string, string>;
  cookies?: Cookie[];
}

const nitroApp = useNitroApp();

export async function handle(context: { res: HttpResponseV3 }, req: HttpRequestV3) {
  let url: string;
  const originalURL = req.headers["x-ms-original-url"];
  if (originalURL) {
    // This URL has been proxied as there was no static file matching it.
    const parsedURL = parseURL(originalURL);
    url = parsedURL.pathname + parsedURL.search;
  } else {
    // Because Azure SWA handles /api/* calls differently they
    // never hit the proxy and we have to reconstitute the URL.
    url = "/api/" + (req.params.url || "");
  }

  const headers = new Headers(req.headers);
  const request = new Request(new URL(url, resolveBaseUrl(headers)), {
    method: req.method || undefined,
    headers,
    // https://github.com/Azure/azure-functions-nodejs-worker/issues/294
    // https://github.com/Azure/azure-functions-host/issues/293
    body: req.bufferBody ?? req.rawBody,
  });

  const response = await nitroApp.fetch(request);

  context.res = {
    status: response.status,
    body: response.body ? Buffer.from(await response.arrayBuffer()) : undefined,
    cookies: getAzureParsedCookiesFromHeaders(response.headers),
    headers: Object.fromEntries(
      [...response.headers.entries()].filter(([key]) => key !== "set-cookie")
    ),
  };
}
