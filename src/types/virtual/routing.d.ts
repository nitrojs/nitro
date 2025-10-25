import type {
  H3EventHandler,
  Middleware,
  H3Route,
  LazyEventHandler,
  RouterMethod,
} from "nitro/h3";
import type { MatchedRoute } from "rou3";
import type { MatchedRouteRule } from "../route-rules";

export function findRoute(
  method: string,
  path: string
): MatchedRoute<H3Route> | undefined;

export function findRouteRules(
  method: string,
  path: string
): MatchedRoute<MatchedRouteRule[]>[];

export const globalMiddleware: Middleware[];

export function findRoutedMiddleware(
  method: string,
  path: string
): MatchedRoute<Middleware>[];
