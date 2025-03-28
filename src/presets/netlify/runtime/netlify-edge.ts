import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";
import { isPublicAssetURL } from "#nitro-internal-virtual/public-assets";
import type { Context } from "@netlify/edge-functions";

const nitroApp = useNitroApp();

// https://docs.netlify.com/edge-functions/api/
export default async function netlifyEdge(request: Request, context: Context) {
  const url = new URL(request.url);

  if (isPublicAssetURL(url.pathname)) {
    return;
  }

  if (!request.headers.has("x-forwarded-proto") && url.protocol === "https:") {
    request.headers.set("x-forwarded-proto", "https");
  }

  return nitroApp.fetch(request, {
    h3: { _platform: { netlify: { request, context } } },
  });
}
