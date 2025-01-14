import type { NitroErrorHandler } from "nitropack/types";
import type { H3Event } from "h3";
import { getRequestHeader, setResponseHeaders } from "h3";

export function defineNitroErrorHandler(
  handler: NitroErrorHandler
): NitroErrorHandler {
  return handler;
}

export function setSecurityHeaders(event: H3Event, allowjs = false) {
  setResponseHeaders(event, {
    // Prevent browser from guessing the MIME types of resources.
    "X-Content-Type-Options": "nosniff",
    // Prevent error page from being embedded in an iframe
    "X-Frame-Options": "DENY",
    // Prevent browsers from sending the Referer header
    "Referrer-Policy": "no-referrer",
    // Disable the execution of any js
    "Content-Security-Policy": allowjs
      ? "script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self';"
      : "script-src 'none'; frame-ancestors 'none';",
  });
}

function hasReqHeader(event: H3Event, name: string, includes: string) {
  const value = getRequestHeader(event, name);
  return (
    value && typeof value === "string" && value.toLowerCase().includes(includes)
  );
}
