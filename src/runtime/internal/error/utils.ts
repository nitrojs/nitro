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

// h3 does not merge `event.res.errHeaders` into responses returned by `onError`
export function createErrorHeaders(event: HTTPEvent, errorHeaders?: HeadersInit): Headers {
  const headers = new Headers(errorHeaders);
  const errHeaders = (event as H3Event).res?.errHeaders;
  if (errHeaders) {
    for (const [name, value] of errHeaders) {
      if (name === "set-cookie") {
        headers.append(name, value);
      } else {
        headers.set(name, value);
      }
    }
  }
  return headers;
}
