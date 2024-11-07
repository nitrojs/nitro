import "#nitro-internal-pollyfills";
import "./_deno-env-polyfill";
import { useNitroApp } from "nitropack/runtime";
import { isPublicAssetURL } from "#nitro-internal-virtual/public-assets";
import type { Context } from "@netlify/edge-functions";

const nitroApp = useNitroApp();

// https://docs.netlify.com/edge-functions/api/
export default async function netlifyEdge(request: Request, _context: Context) {
  const url = new URL(request.url);

  if (isPublicAssetURL(url.pathname)) {
    return;
  }

  if (!request.headers.has("x-forwarded-proto") && url.protocol === "https:") {
    request.headers.set("x-forwarded-proto", "https");
  }

  let body;
  if (request.body) {
    body = await request.arrayBuffer();
  }

  return nitroApp.localFetch(url.pathname + url.search, {
    host: url.hostname,
    protocol: url.protocol,
    headers: request.headers,
    method: request.method,
    redirect: request.redirect,
    body,
  });
}
