import "./_runtime_warn.ts";

import type { Middleware, H3Route } from "h3";
import type { MatchedRoute } from "rou3";
import type { MatchedRouteRule } from "nitro/types";

export function findRoute(_method: string, _path: string): MatchedRoute<H3Route> | undefined {
  return undefined;
}

export function findRouteRules(_method: string, _path: string): MatchedRoute<MatchedRouteRule[]>[] {
  return [];
}

export const globalMiddleware: Middleware[] = [];

export function findRoutedMiddleware(_method: string, _path: string): MatchedRoute<Middleware>[] {
  return [];
}
