import {
  getRequestURL,
  getResponseHeader,
  send,
  sendRedirect,
  setResponseHeader,
  setResponseStatus,
} from "h3";
import { defineNitroErrorHandler, setSecurityHeaders } from "./utils";

export default defineNitroErrorHandler(
  function defaultNitroErrorHandler(error, event) {
    const isSensitive = error.unhandled || error.fatal;
    const statusCode = error.statusCode || 500;
    const statusMessage = error.statusMessage || "Server Error";
    // prettier-ignore
    const url = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true })

    if (statusCode === 404) {
      const baseURL = import.meta.baseURL || "/";
      if (baseURL.length > 1 && !url.pathname.startsWith(baseURL)) {
        return sendRedirect(
          event,
          `${baseURL}${url.pathname.slice(1)}${url.search}`
        );
      }
    }

    // Console output
    if (isSensitive) {
      // prettier-ignore
      const tags = [error.unhandled && "[unhandled]", error.fatal && "[fatal]"].filter(Boolean).join(" ")
      console.error(
        `[request error] ${tags} [${event.method}] ${url}\n`,
        error
      );
    }

    // Send response
    setSecurityHeaders(event, false /* no js */);
    setResponseStatus(event, statusCode, statusMessage);
    if (statusCode === 404 || !getResponseHeader(event, "cache-control")) {
      setResponseHeader(event, "cache-control", "no-cache");
    }
    return send(
      event,
      JSON.stringify(
        {
          error: true,
          url: url.href,
          statusCode,
          statusMessage,
          message: isSensitive ? "Server Error" : error.message,
          data: isSensitive ? undefined : error.data,
        },
        null,
        2
      ),
      "application/json"
    );
  }
);
