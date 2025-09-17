import type {
  H3EventHandler,
  H3Route,
  LazyEventHandler,
  RouterMethod,
} from "h3";
import type { MatchedRoute } from "rou3";
import type { MatchedRouteRule } from "../route-rules";

export function findRoute(
  method: string,
  path: string
): MatchedRoute<H3Route> | undefined;

export function findRouteRules(
  method: string,
  path: string
): MatchedRoute<MatchedRouteRule<"isr">[]>[] | undefined;

export const middleware: {
  route?: string;
  method?: string;
  handler: Middleware;
}[];
