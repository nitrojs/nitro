import type { H3Event, HTTPError, HTTPEvent } from "h3";
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
  const isSensitive = error.unhandled;
  const status = error.status || 500;
  const url = (event as H3Event).url || new URL(event.req.url);

  if (status === 404) {
    const baseURL = import.meta.baseURL || "/";
    if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) {
      const redirectTo = `${baseURL}${url.pathname.slice(1)}${url.search}`;
      return {
        status: 302,
        statusText: "Found",
        headers: { location: redirectTo },
        body: `Redirecting...`,
      };
    }
  }

  // Console output
  if (isSensitive && !opts?.silent) {
    // prettier-ignore
    const tags = [error.unhandled && "[unhandled]"].filter(Boolean).join(" ")
    console.error(`[request error] ${tags} [${event.req.method}] ${url}\n`, error);
  }

  // Send response
  const headers: HeadersInit = {
    "content-type": "application/json",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "content-security-policy": "script-src 'none'; frame-ancestors 'none';",
  };

  if (status === 404 || !(event as H3Event).res.headers.has("cache-control")) {
    headers["cache-control"] = "no-cache";
  }

  const body = {
    error: true,
    url: url.href,
    status,
    statusText: error.statusText,
    message: isSensitive ? "Server Error" : error.message,
    data: isSensitive ? undefined : error.data,
  };

  return {
    status,
    statusText: error.statusText,
    headers,
    body,
  };
}
