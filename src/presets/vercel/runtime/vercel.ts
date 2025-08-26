import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";

import { toNodeHandler } from "srvx/node";
import type { NodeHttpHandler } from "srvx";
import { parseQuery } from "ufo";

const nitroApp = useNitroApp();

const appHandler = toNodeHandler(nitroApp.fetch);

const listener: NodeHttpHandler = function (req, res) {
  const query = req.headers["x-now-route-matches"] as string;
  if (query) {
    const { url } = parseQuery(query);
    if (url) {
      req.url = url as string;
    }
  }
  return appHandler(req, res);
};

export default listener;
