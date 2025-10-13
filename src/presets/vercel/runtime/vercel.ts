import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitropack/runtime";

import { type NodeListener, toNodeListener } from "h3";
import { parseQuery, withQuery } from "ufo";
import { ISR_URL_PARAM } from "./consts";

const nitroApp = useNitroApp();

const handler = toNodeListener(nitroApp.h3App);

const listener: NodeListener = function (req, res) {
  const isrRoute = req.headers["x-now-route-matches"] as string;
  if (isrRoute) {
    const { url } = parseQuery(isrRoute);
    if (url) {
      req.url = url as string;
    }
  } else {
    // Workaround for ISR functions with passQuery: true
    // /__fallback--api-weather?__isr_route=%2Fapi%2Fweather%2Famsterdam&units=123"
    const queryIndex = req.url!.indexOf("?");
    const urlQueryIndex =
      queryIndex === -1
        ? -1
        : req.url!.indexOf(`${ISR_URL_PARAM}=`, queryIndex);
    if (urlQueryIndex !== -1) {
      const { [ISR_URL_PARAM]: url, ...params } = parseQuery(
        req.url!.slice(queryIndex)
      );
      req.url = withQuery((url as string) || "/", params);
    }
  }
  return handler(req, res);
};

export default listener;
