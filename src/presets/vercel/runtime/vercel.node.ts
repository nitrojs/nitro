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
  // Replace req.socket.remoteAddress with the X-Forwarded-For header.
  // req.socket.remoteAddress is used by the srvx Node adapter to obtain the client IP.
  Object.defineProperty(req.socket, "remoteAddress", {
    value: req.headers["x-forwarded-for"],
  });

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
