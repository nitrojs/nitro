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
  let url: string | undefined;
  let params: Record<string, any> | undefined;

  if (isrRoute) {
    const parsed = parseQuery(isrRoute);
    const candidate = parsed[ISR_URL_PARAM];
    if (candidate && typeof candidate === "string") {
      url = candidate;
    }
  }

  if (!url) {
    // The `x-now-route-matches` contract is undocumented and has changed
    // before (nitrojs/nitro#3595, #3539). When the header is absent or
    // carries no `__isr_route` group, fall back to the destination query
    // string, which the ISR rewrite populates with the same value.
    const queryIndex = req.url!.indexOf("?");
    const urlQueryIndex =
      queryIndex === -1
        ? -1
        : req.url!.indexOf(`${ISR_URL_PARAM}=`, queryIndex);
    if (urlQueryIndex !== -1) {
      const parsed = parseQuery(req.url!.slice(queryIndex));
      const candidate = parsed[ISR_URL_PARAM];
      if (candidate && typeof candidate === "string") {
        url = candidate;
        const { [ISR_URL_PARAM]: _, ...rest } = parsed;
        params = rest;
      }
    }
  }

  if (url) {
    const routeRules = getRouteRulesForPath(url) as NitroRouteRules;
    if (routeRules.isr) {
      req.url = params ? withQuery(url, params) : url;
      return handler(req, res);
    }
  }

  // Fail-safe: an ISR invocation whose original URL cannot be recovered from
  // any carrier would otherwise render the internal `-isr` route, and a 404
  // rendered there is stored by Vercel as a valid ISR outcome (cache
  // poisoning). Respond 503 instead so the miss stays transient and any
  // cached copy keeps serving (x-vercel-cache: STALE).
  const path = (req.url || "/").split("?")[0]!;
  if (path.endsWith("-isr")) {
    res.statusCode = 503;
    res.setHeader("content-type", "text/plain");
    res.end("ISR invocation could not be resolved");
    return;
  }

  return handler(req, res);
};

export default listener;
