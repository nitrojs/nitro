import "#internal/nitro/virtual/polyfill";
import { nitroApp } from "#internal/nitro/app";

import { toNodeListener, NodeListener } from "h3";
import { parseQuery } from "ufo";

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
