import { type H3Event, getRequestURL } from "h3";
import type { NitroErrorHandler } from "nitropack/types";

export function defineNitroErrorHandler(
  handler: NitroErrorHandler
): NitroErrorHandler {
  return handler;
}

/**
 * Resolves the request URL for error handlers. The `Host` header is
 * unvalidated input, and `new URL()` throws for unparsable values (e.g.
 * `Host: a b`) — which would turn the error handler itself into an
 * unhandled rejection. Fall back to a synthetic authority so the handler
 * can render for any request; path and query are preserved.
 */
export function getRequestURLOrFallback(event: H3Event): URL {
  try {
    return getRequestURL(event, {
      xForwardedHost: true,
      xForwardedProto: true,
    });
  } catch {
    return new URL(event.path || "/", "http://localhost");
  }
}

export type InternalHandlerResponse = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string | Record<string, any>;
};
