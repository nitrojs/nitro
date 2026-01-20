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
  // https://vercel.com/docs/headers/request-headers#x-forwarded-for
  // srvx node adapter uses req.socket.remoteAddress for req.ip
  let ip: string | undefined;
  Object.defineProperty(req.socket, "remoteAddress", {
    get() {
      const h = req.headers["x-forwarded-for"] as string;
      return (ip ??= h?.split?.(",").shift()?.trim());
    },
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
