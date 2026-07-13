import "./_runtime_warn.ts";

import type { Middleware, H3Route } from "h3";
import type { MatchedRoute } from "rou3";
import type { RouteRuleLayer } from "h3-rules";

export function findRoute(_method: string, _path: string): MatchedRoute<H3Route> | undefined {
  return undefined;
}

export function findRouteRules(_method: string, _path: string): RouteRuleLayer[] {
  return [];
}

export const globalMiddleware: Middleware[] = [];

export function findRoutedMiddleware(_method: string, _path: string): MatchedRoute<Middleware>[] {
  return [];
}
