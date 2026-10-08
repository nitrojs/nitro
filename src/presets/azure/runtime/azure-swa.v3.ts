import "#nitro/virtual/polyfills";
import { useNitroApp } from "nitro/app";
import { getAzureParsedCookiesFromHeaders, getRequestURL } from "./_utils.ts";

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
  // Proxied requests (no matching static file) carry the original URL in `x-ms-original-url`.
  // Azure SWA handles /api/* calls differently, they never hit the proxy and we have to reconstitute the URL.
  const headers = new Headers(req.headers);
  const url = getRequestURL(
    req.headers["x-ms-original-url"] || "/api/" + (req.params.url || ""),
    headers
  );

  const request = new Request(url, {
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
