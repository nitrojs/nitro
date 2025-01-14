import { getRequestURL, send, setResponseHeader, setResponseStatus } from "h3";
import { defineNitroErrorHandler, setSecurityHeaders } from "./utils";

export default defineNitroErrorHandler(
  function defaultNitroErrorHandler(error, event) {
    const statusCode = error.statusCode || 500;
    const statusMessage = error.statusMessage || "Internal Server Error";
    // prettier-ignore
    const url = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).toString();

    // 404
    if (statusCode === 404) {
      setResponseHeader(event, "Cache-Control", "no-cache");
      return send(event, "");
    }

    // Console output
    if (error.unhandled || error.fatal) {
      // prettier-ignore
      const tags = [error.unhandled && "[unhandled]", error.fatal && "[fatal]"].filter(Boolean).join(" ")
      console.error(
        `[nitro] [request error] ${tags} [${event.method}] ${event.path}\n`,
        error
      );
    }

    // Send response
    setSecurityHeaders(event, false /* no js */);
    setResponseStatus(event, statusCode, statusMessage);
    return send(
      event,
      JSON.stringify(
        {
          url,
          statusCode,
          statusMessage,
          message: "server error",
          data: error.data,
        },
        null,
        2
      ),
      "application/json"
    );
  }
);
