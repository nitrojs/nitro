import { proxyRequest, redirect as sendRedirect } from "h3";
import type { Middleware } from "h3";
import type { MatchedRouteRule, NitroRouteRules } from "nitro/types";
import { joinURL, withQuery, withoutBase } from "ufo";

type RouteRuleCtor<T extends keyof NitroRouteRules> = (
  m: MatchedRouteRule<T>
) => Middleware;

export const RuntimeRouteRules = [
  "headers",
  "redirect",
  "proxy",
  // "cache",
] as string[];

// Headers route rule
export const headers = <RouteRuleCtor<"headers">>((m) =>
  function headersRouteRule(event) {
    for (const [key, value] of Object.entries(m.options || {})) {
      event.res.headers.set(key, value);
    }
  });

// Redirect route rule
export const redirect = <RouteRuleCtor<"redirect">>((m) =>
  function redirectRouteRule(event) {
    let target = m.options?.to;
    if (!target) {
      return;
    }
    if (target.endsWith("/**")) {
      let targetPath = event.url.pathname + event.url.search;
      const strpBase = (m.options as any)._redirectStripBase;
      if (strpBase) {
        targetPath = withoutBase(targetPath, strpBase);
      }
      target = joinURL(target.slice(0, -3), targetPath);
    } else if (event.url.search) {
      target = withQuery(target, Object.fromEntries(event.url.searchParams));
    }
    return sendRedirect(event, target, m.options?.status);
  });

// Proxy route rule
export const proxy = <RouteRuleCtor<"proxy">>((m) =>
  function proxyRouteRule(event) {
    let target = m.options?.to;
    if (!target) {
      return;
    }
    if (target.endsWith("/**")) {
      let targetPath = event.url.pathname + event.url.search;
      const strpBase = (m.options as any)._proxyStripBase;
      if (strpBase) {
        targetPath = withoutBase(targetPath, strpBase);
      }
      target = joinURL(target.slice(0, -3), targetPath);
    } else if (event.url.search) {
      target = withQuery(target, Object.fromEntries(event.url.searchParams));
    }
    return proxyRequest(event, target, {
      ...m.options,
    });
  });
