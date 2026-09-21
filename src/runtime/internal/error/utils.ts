import type { H3Event, HTTPEvent } from "h3";
import type { NitroErrorHandler } from "nitro/types";

export function defineNitroErrorHandler(handler: NitroErrorHandler): NitroErrorHandler {
  return handler;
}

export type InternalHandlerResponse = {
  status?: number;
  statusText?: string | undefined;
  headers?: HeadersInit;
  body?: string | Record<string, any>;
};

// h3 does not merge `event.res.errHeaders` into responses returned by `onError`.
// Explicit `error.headers` take precedence over staged duplicate names; set-cookie appends from both.
export function createErrorHeaders(event: HTTPEvent, errorHeaders?: HeadersInit): Headers {
  const errHeaders = (event as H3Event).res?.errHeaders;
  const headers = errHeaders ? new Headers(errHeaders) : new Headers();
  if (errorHeaders) {
    for (const [name, value] of new Headers(errorHeaders)) {
      if (name === "set-cookie") {
        headers.append(name, value);
      } else {
        headers.set(name, value);
      }
    }
  }
  return headers;
}
