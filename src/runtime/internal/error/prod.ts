import type { H3Event, HTTPError, HTTPEvent } from "nitro/deps/h3";
import { getRequestURL } from "nitro/deps/h3";
import { defineNitroErrorHandler } from "./utils";
import type { InternalHandlerResponse } from "./utils";
import { FastResponse } from "srvx";

export default defineNitroErrorHandler(
  function defaultNitroErrorHandler(error, event) {
    const res = defaultHandler(error, event);
    return new FastResponse(JSON.stringify(res.body, null, 2), res);
  }
);

export function defaultHandler(
  error: HTTPError,
  event: HTTPEvent,
  opts?: { silent?: boolean; json?: boolean }
): InternalHandlerResponse {
  const isSensitive = error.unhandled;
  const status = error.status || 500;
  // prettier-ignore
  const url = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true })

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
    console.error(
      `[request error] ${tags} [${event.req.method}] ${url}\n`,
      error
    );
  }

  // Send response
  const headers: HeadersInit = {
    "content-type": "application/json",
    // Prevent browser from guessing the MIME types of resources.
    "x-content-type-options": "nosniff",
    // Prevent error page from being embedded in an iframe
    "x-frame-options": "DENY",
    // Prevent browsers from sending the Referer header
    "referrer-policy": "no-referrer",
    // Disable the execution of any js
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
