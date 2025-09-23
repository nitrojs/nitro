import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";
import { isPublicAssetURL } from "#nitro-internal-virtual/public-assets";
import type { Context } from "@netlify/edge-functions";
import type { ServerRequest } from "srvx";

const nitroApp = useNitroApp();

// https://docs.netlify.com/edge-functions/api/
export default async function netlifyEdge(
  netlifyReq: Request,
  context: Context
) {
  // srvx compatibility
  const req = netlifyReq as unknown as ServerRequest;
  req.runtime ??= { name: "netlify-edge" };
  // @ts-expect-error (add to srvx types)
  req.runtime.netlify ??= { context } as any;

  const url = new URL(req.url);

  if (isPublicAssetURL(url.pathname)) {
    return;
  }

  if (!req.headers.has("x-forwarded-proto") && url.protocol === "https:") {
    req.headers.set("x-forwarded-proto", "https");
  }

  return nitroApp.fetch(req);
}
