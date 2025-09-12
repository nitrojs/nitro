import type {
  H3EventHandler,
  H3Route,
  LazyEventHandler,
  RouterMethod,
} from "h3";
import type { MatchedRoute } from "rou3";

export function findRoute(
  method: string,
  path: string
): MatchedRoute<H3Route> | undefined;
