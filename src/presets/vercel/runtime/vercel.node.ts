import "#nitro/virtual/polyfills";
import type { NodeServerRequest, NodeServerResponse } from "srvx";
import { toNodeHandler } from "srvx/node";
import { useNitroApp, getRouteRules } from "nitro/app";
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
    const { routeRules } = getRouteRules("", isrURL[0]);
    if (routeRules?.isr) {
      req.url = isrURL[0] + (isrURL[1] ? `?${isrURL[1]}` : "");
    }
  }

  return handler(req as any, res as any);
}
