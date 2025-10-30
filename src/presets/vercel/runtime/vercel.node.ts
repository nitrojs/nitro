import "#nitro-internal-pollyfills";
import type { NodeServerRequest, NodeServerResponse } from "srvx";
import { toNodeHandler } from "srvx/node";
import { useNitroApp } from "nitro/runtime";

const nitroApp = useNitroApp();

const handler = toNodeHandler(nitroApp.fetch);

export default function nodeHandler(
  req: NodeServerRequest,
  res: NodeServerResponse
) {
  const query = req.headers["x-now-route-matches"] as string;
  if (query) {
    const url = new URLSearchParams(query).get("url");
    if (url) {
      req.url = decodeURIComponent(url);
    }
  }
  return handler(req, res);
}
