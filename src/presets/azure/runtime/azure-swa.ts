import "#nitro/virtual/polyfills";
import { app } from "@azure/functions";
import { parseURL } from "ufo";
import { useNitroApp } from "nitro/app";
import { getAzureParsedCookiesFromHeaders, resolveBaseUrl } from "./_utils.ts";

import type { HttpRequest, HttpResponseInit } from "@azure/functions";

const nitroApp = useNitroApp();

// https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node?pivots=nodejs-model-v4
app.http("server", {
  route: "{*url}",
  methods: ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"],
  authLevel: "anonymous",
  handler: handle,
});

async function handle(req: HttpRequest): Promise<HttpResponseInit> {
  let url: string;
  const originalURL = req.headers.get("x-ms-original-url");
  if (originalURL) {
    // This URL has been proxied as there was no static file matching it.
    const parsedURL = parseURL(originalURL);
    url = parsedURL.pathname + parsedURL.search;
  } else {
    // Because Azure SWA handles /api/* calls differently they
    // never hit the proxy and we have to reconstitute the URL.
    url = "/api/" + (req.params.url || "") + parseURL(req.url).search;
  }

  const request = new Request(new URL(url, resolveBaseUrl(req.headers)), {
    method: req.method,
    headers: req.headers,
    body: req.body ? await req.arrayBuffer() : undefined,
  });

  const response = await nitroApp.fetch(request);

  return {
    status: response.status,
    body: response.body,
    cookies: getAzureParsedCookiesFromHeaders(response.headers),
    headers: Object.fromEntries(
      [...response.headers.entries()].filter(([key]) => key !== "set-cookie")
    ),
  };
}
