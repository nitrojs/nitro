import {
  type H3Error,
  type H3Event,
  getRequestURL,
  getResponseHeader,
  send,
  setResponseHeaders,
  setResponseStatus,
} from "h3";
import { defineNitroErrorHandler, type InternalHandlerResponse } from "./utils";

export default defineNitroErrorHandler(
  function defaultNitroErrorHandler(error, event) {
    const res = defaultHandler(error, event);
    setResponseHeaders(event, res.headers);
    setResponseStatus(event, res.status, res.statusText);
    return send(event, JSON.stringify(res.body, null, 2));
  }
);

export function defaultHandler(
  error: H3Error,
  event: H3Event,
  opts?: { silent?: boolean; json?: boolean }
): InternalHandlerResponse {
  const isSensitive = error.unhandled || error.fatal;
  const statusCode = error.statusCode || 500;
  const statusMessage = error.statusMessage || "Server Error";
  // prettier-ignore
  const url = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true })

  if (statusCode === 404) {
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
    const tags = [error.unhandled && "[unhandled]", error.fatal && "[fatal]"].filter(Boolean).join(" ")
    console.error(`[request error] ${tags} [${event.method}] ${url}\n`, error);
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
  setResponseStatus(event, statusCode, statusMessage);
  if (statusCode === 404 || !getResponseHeader(event, "cache-control")) {
    headers["cache-control"] = "no-cache";
  }

  const body = {
    error: true,
    url: url.href,
    statusCode,
    statusMessage,
    message: isSensitive ? "Server Error" : error.message,
    data: isSensitive ? undefined : error.data,
  };

  return {
    status: statusCode,
    statusText: statusMessage,
    headers,
    body,
  };
}
