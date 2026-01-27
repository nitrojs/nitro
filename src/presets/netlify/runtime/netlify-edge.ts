import "#nitro/virtual/polyfills";
import { useNitroApp } from "nitro/app";
import { isPublicAssetURL } from "#nitro/virtual/public-assets";
import type { Context } from "@netlify/edge-functions";
import type { ServerRequest } from "srvx";

const nitroApp = useNitroApp();

// https://docs.netlify.com/edge-functions/api/
export default async function netlifyEdge(netlifyReq: Request, context: Context) {
  // srvx compatibility
  const req = netlifyReq as unknown as ServerRequest;
  req.ip = context.ip;
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
