import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitropack/runtime";
// @ts-ignore
import { getRouteRulesForPath } from "nitropack/runtime/internal/index";
import type { NitroRouteRules } from "nitropack/types";
import { type NodeListener, toNodeListener } from "h3";
import { parseQuery, withQuery } from "ufo";
import { ISR_URL_PARAM } from "./consts";

const nitroApp = useNitroApp();

const handler = toNodeListener(nitroApp.h3App);

const listener: NodeListener = function (req, res) {
  const isrRoute = req.headers["x-now-route-matches"] as string;
  if (isrRoute) {
    const { [ISR_URL_PARAM]: url } = parseQuery(isrRoute);
    if (url && typeof url === "string") {
      const routeRules = getRouteRulesForPath(url) as NitroRouteRules;
      if (routeRules.isr) {
        req.url = url;
      }
    }
  } else {
    // Route rules with isr: { passQuery: true }
    const queryIndex = req.url!.indexOf("?");
    const urlQueryIndex =
      queryIndex === -1
        ? -1
        : req.url!.indexOf(`${ISR_URL_PARAM}=`, queryIndex);
    if (urlQueryIndex !== -1) {
      const { [ISR_URL_PARAM]: url, ...params } = parseQuery(
        req.url!.slice(queryIndex)
      );
      if (url && typeof url === "string") {
        const routeRules = getRouteRulesForPath(url) as NitroRouteRules;
        if (routeRules.isr) {
          req.url = withQuery(url, params);
        }
      }
    }
  }
  return handler(req, res);
};

export default listener;
