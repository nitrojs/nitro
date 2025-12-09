import "#nitro-internal-polyfills";
import type { NodeServerRequest, NodeServerResponse } from "srvx";
import { toNodeHandler } from "srvx/node";
import { useNitroApp } from "nitro/app";
import { isrRouteRewrite } from "./isr.ts";

const nitroApp = useNitroApp();

const handler = toNodeHandler(nitroApp.fetch);

export default function nodeHandler(
  req: NodeServerRequest,
  res: NodeServerResponse
) {
  // ISR route rewrite
  const isrURL = isrRouteRewrite(
    req.url!,
    req.headers["x-now-route-matches"] as string
  );
  if (isrURL) {
    req.url = isrURL;
  }

  return handler(req, res);
}
