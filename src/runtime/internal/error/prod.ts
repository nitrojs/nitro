import { type HTTPError, type H3Event, getRequestURL } from "h3";
import { defineNitroErrorHandler, type InternalHandlerResponse } from "./utils";

export default defineNitroErrorHandler(
  function defaultNitroErrorHandler(error, event) {
    const res = defaultHandler(error, event);
    event.res.status = res.status;
    event.res.statusText = res.statusText;
    for (const [key, value] of Object.entries(res.headers)) {
      event.res.headers.set(key, value);
    }
    return JSON.stringify(res.body, null, 2);
  }
);

export function defaultHandler(
  error: HTTPError,
  event: H3Event,
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
  event.res.status = status;
  event.res.statusText = error.statusText;
  if (status === 404 || !event.res.headers.has("cache-control")) {
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
