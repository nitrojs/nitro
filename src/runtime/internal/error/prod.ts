import { getRequestURL, send, setResponseHeader, setResponseStatus } from "h3";
import { defineNitroErrorHandler, setSecurityHeaders } from "./utils";

export default defineNitroErrorHandler(
  function defaultNitroErrorHandler(error, event) {
    const statusCode = error.statusCode || 500;
    const statusMessage = error.statusMessage || "Server Error";
    // prettier-ignore
    const url = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).toString();

    // Console output
    if (error.unhandled || error.fatal) {
      // prettier-ignore
      const tags = [error.unhandled && "[unhandled]", error.fatal && "[fatal]"].filter(Boolean).join(" ")
      console.error(
        `[nitro] [request error] ${tags} [${event.method}] ${url}\n`,
        error
      );
    }

    // Send response
    setSecurityHeaders(event, false /* no js */);
    setResponseStatus(event, statusCode, statusMessage);
    if (statusCode === 404) {
      setResponseHeader(event, "Cache-Control", "no-cache");
    }
    return send(
      event,
      JSON.stringify(
        {
          error: true,
          url,
          statusCode,
          statusMessage,
          message:
            error.unhandled || error.fatal ? "Server Error" : error.message,
          data: error.data,
        },
        null,
        2
      ),
      "application/json"
    );
  }
);
