import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitropack/runtime";
import { isPublicAssetURL } from "#nitro-internal-virtual/public-assets";
import type { Context } from "@netlify/edge-functions";
import { toWebHandler } from "h3";

const nitroApp = useNitroApp();

const handler = toWebHandler(nitroApp.h3App);

// https://docs.netlify.com/edge-functions/api/
export default async function netlifyEdge(request: Request, _context: Context) {
  const url = new URL(request.url);

  if (isPublicAssetURL(url.pathname)) {
    return;
  }

  if (!request.headers.has("x-forwarded-proto") && url.protocol === "https:") {
    request.headers.set("x-forwarded-proto", "https");
  }

  return handler(request);
}
