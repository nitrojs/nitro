import { HTTPError, type H3Event, type HTTPEvent } from "h3";
import type { InternalHandlerResponse } from "./utils.ts";
import { FastResponse } from "srvx";
import type { NitroErrorHandler } from "nitro/types";

const errorHandler: NitroErrorHandler = (error, event) => {
  const res = defaultHandler(error, event);
  return new FastResponse(
    typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2),
    res
  );
};

export default errorHandler;

export function defaultHandler(
  error: HTTPError,
  event: HTTPEvent,
  opts?: { silent?: boolean; json?: boolean }
): InternalHandlerResponse {
  const status = error.status || 500;
  const unhandled = error.unhandled ?? !HTTPError.isError(error);
  const url = (event as H3Event).url || new URL(event.req.url);

  if (status === 404) {
    const baseURL = import.meta.baseURL || "/";
    if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) {
      return {
        status: 302,
        headers: new Headers({ location: `${baseURL}${url.pathname.slice(1)}${url.search}` }),
      };
    }
  }

  if (unhandled) {
    !opts?.silent &&
      console.error(new Error(`[request error] [${event.req.method}] ${url}`, { cause: error }));
    return { status };
  }

  return {
    status,
    statusText: error.statusText,
    headers: new Headers(error.headers),
    body: error.toJSON?.(),
  };
}
