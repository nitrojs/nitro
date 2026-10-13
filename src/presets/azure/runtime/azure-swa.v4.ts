import "#nitro/virtual/polyfills";
import { app } from "@azure/functions";
import { useNitroApp } from "nitro/app";
import { getAzureParsedCookiesFromHeaders, getRequestURL } from "./_utils.ts";

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
  // Proxied requests (no matching static file) carry the original URL in `x-ms-original-url`
  const url = getRequestURL(req.headers.get("x-ms-original-url") || req.url, req.headers);

  const request = new Request(url, {
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
