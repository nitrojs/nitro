import {
  send,
  getRequestHeaders,
  setResponseHeader,
  setResponseStatus,
  getRequestURL,
} from "h3";

import consola from "consola";
import { Youch } from "youch";

import {
  defineNitroErrorHandler,
  isJsonRequest,
  setSecurityHeaders,
} from "./utils";

export default defineNitroErrorHandler(
  async function defaultNitroErrorHandler(error, event) {
    const statusCode = error.statusCode || 500;
    const statusMessage = error.statusMessage || "Internal Server Error";
    // prettier-ignore
    const url = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).toString();

    const youch = new Youch();

    // Console output
    if (error.unhandled || error.fatal) {
      // prettier-ignore
      const tags = [error.unhandled && "[unhandled]", error.fatal && "[fatal]"].filter(Boolean).join(" ")
      // const ansiError = await youch.toANSI(error);
      consola.error(
        `[nitro] [request error] ${tags} [${event.method}] ${url}\n`,
        error
      );
    }

    // Send response
    setResponseStatus(event, statusCode, statusMessage);
    setSecurityHeaders(event, true /* allow js */);
    if (statusCode === 404) {
      setResponseHeader(event, "Cache-Control", "no-cache");
    }
    return isJsonRequest(event)
      ? send(
          event,
          JSON.stringify(
            {
              error: true,
              url,
              statusCode,
              statusMessage,
              message: error.message,
              data: error.data,
              stack: error.stack?.split("\n").map((line) => line.trim()),
            },
            null,
            2
          ),
          "application/json"
        )
      : send(
          event,
          await youch.toHTML(error, {
            request: {
              url,
              method: event.method,
              headers: getRequestHeaders(event),
            },
          }),
          "text/html"
        );
  }
);
