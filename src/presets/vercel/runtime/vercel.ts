import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";

import { type NodeListener, toNodeListener } from "h3";
import { parseQuery } from "ufo";

const nitroApp = useNitroApp();

const handler = toNodeListener(nitroApp.h3App);

const listener: NodeListener = function (req, res) {
  const query = req.headers["x-now-route-matches"] as string;
  if (query) {
    const { url } = parseQuery(query);
    if (url) {
      req.url = url as string;
    }
  }
  return handler(req, res);
};

export default listener;
