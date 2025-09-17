import { proxyRequest, redirect as sendRedirect } from "h3";
import type { Middleware } from "h3";
import type { NitroRouteRules } from "nitro/types";
import { joinURL, withQuery, withoutBase } from "ufo";

type RouteRuleCtor<T> = (options: T) => Middleware;

// Headers route rule
export const headers = <RouteRuleCtor<NitroRouteRules["headers"]>>((options) =>
  function headersRouteRule(event) {
    for (const [key, value] of Object.entries(options || {})) {
      event.res.headers.set(key, value);
    }
  });

// Redirect route rule
export const redirect = <RouteRuleCtor<NitroRouteRules["redirect"]>>((
  options
) =>
  function redirectRouteRule(event) {
    let target = options?.to;
    if (!target) {
      return;
    }
    if (target.endsWith("/**")) {
      let targetPath = event.url.pathname + event.url.search;
      const strpBase = (options as any)._redirectStripBase;
      if (strpBase) {
        targetPath = withoutBase(targetPath, strpBase);
      }
      target = joinURL(target.slice(0, -3), targetPath);
    } else if (event.url.search) {
      target = withQuery(target, Object.fromEntries(event.url.searchParams));
    }
    return sendRedirect(event, target, options?.status);
  });

// Proxy route rule
export const proxy = <RouteRuleCtor<NitroRouteRules["proxy"]>>((options) =>
  function proxyRouteRule(event) {
    let target = options?.to;
    if (!target) {
      return;
    }
    if (target.endsWith("/**")) {
      let targetPath = event.url.pathname + event.url.search;
      const strpBase = (options as any)._proxyStripBase;
      if (strpBase) {
        targetPath = withoutBase(targetPath, strpBase);
      }
      target = joinURL(target.slice(0, -3), targetPath);
    } else if (event.url.search) {
      target = withQuery(target, Object.fromEntries(event.url.searchParams));
    }
    return proxyRequest(event, target, {
      ...options,
    });
  });
