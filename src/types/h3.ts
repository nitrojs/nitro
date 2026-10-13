import type { H3Event as _H3Event } from "h3";
import type { CapturedErrorContext } from "./runtime/index.ts";
import type { ResolvedRouteRules } from "./route-rules.ts";

declare module "srvx" {
  interface ServerRequestContext {
    routeRules?: Readonly<ResolvedRouteRules>;
    nitro?: {
      errors?: { error?: Error; context: CapturedErrorContext }[];
    };
  }
}

// eslint-disable-next-line unicorn/require-module-specifiers
export type {};
