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
  const queryIndex = req.url!.indexOf("?");
  const { [ISR_URL_PARAM]: queryURL, ...params } =
    queryIndex === -1 ? {} : parseQuery(req.url!.slice(queryIndex));

  // The ISR route param is carried by `x-now-route-matches` when Vercel
  // rewrites via the route regex, and by the request URL otherwise. The header
  // is undocumented and has changed shape before, so fall back to the request
  // URL when it arrives without the param (the rewrite writes the same value
  // into both).
  const xNowRouteMatches = req.headers["x-now-route-matches"] as string;
  const headerURL = xNowRouteMatches
    ? parseQuery(xNowRouteMatches)[ISR_URL_PARAM]
    : undefined;
  const url = headerURL && typeof headerURL === "string" ? headerURL : queryURL;

  if (url && typeof url === "string") {
    const routeRules = getRouteRulesForPath(url) as NitroRouteRules;
    if (routeRules.isr) {
      // Keep `allowQuery` params, which Vercel forwards on the request URL.
      // Other `x-now-route-matches` entries are route capture groups, not
      // user query, so they are not merged in.
      req.url = Object.keys(params).length > 0 ? withQuery(url, params) : url;
    }
  }

  return handler(req, res);
};

export default listener;
