import { HTTPError, type HTTPEvent } from "h3";
import { getRequestURL } from "h3";
import { defineErrorHandler } from "./utils.ts";
import type { InternalHandlerResponse } from "./utils.ts";
import { FastResponse } from "srvx";
import type { NitroErrorHandler } from "nitro/types";
import { loadStackTrace } from "./_stack.ts";
import { renderErrorANSI, renderErrorHTML } from "./_utils.ts";

export { loadStackTrace } from "./_stack.ts";

const errorHandler: NitroErrorHandler = defineErrorHandler(
  async function defaultNitroErrorHandler(error, event) {
    const res = await defaultHandler(error, event);
    return new FastResponse(
      typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2),
      res
    );
  }
);

export default errorHandler;

export async function defaultHandler(
  error: HTTPError,
  event: HTTPEvent,
  opts?: { silent?: boolean; json?: boolean }
): Promise<InternalHandlerResponse> {
  const unhandled = error.unhandled ?? !HTTPError.isError(error);
  const { status = 500, statusText = "" } = unhandled ? {} : error;
  const url = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true });

  // Redirects with base URL
  if (status === 404) {
    const baseURL = import.meta.baseURL || "/";
    if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) {
      return {
        status: 302,
        statusText: "Found",
        headers: new Headers({ location: `${baseURL}${url.pathname.slice(1)}${url.search}` }),
        body: `Redirecting...`,
      };
    }
  }

  // Load stack trace with source maps
  await loadStackTrace(error).catch(console.error);

  // Unhandled errors are wrapped in an HTTPError that shares the stack of the original error
  const displayError = unhandled && error.cause instanceof Error ? error.cause : error;

  // Console output
  if (unhandled && !opts?.silent) {
    const ansiError = await renderErrorANSI(displayError);
    console.error(`[request error] [${event.req.method}] ${url}`);
    console.error(ansiError + "\n");
  }

  // Use HTML response only when user-agent expects it (browsers)
  const useJSON = opts?.json ?? !event.req.headers.get("accept")?.includes("text/html");

  const headers = new Headers(unhandled ? {} : error.headers);

  if (useJSON) {
    headers.set("Content-Type", "application/json; charset=utf-8");
    const jsonBody =
      typeof error.toJSON === "function"
        ? error.toJSON()
        : { status, statusText, message: error.message };
    return {
      status,
      statusText,
      headers,
      body: {
        error: true,
        stack: error.stack?.split("\n").map((line) => line.trim()),
        ...jsonBody,
      },
    };
  }

  // HTML response
  headers.set("Content-Type", "text/html; charset=utf-8");
  return {
    status,
    statusText: unhandled ? "" : error.statusText,
    headers,
    body: await renderErrorHTML(displayError, {
      status,
      statusText: unhandled ? "" : error.statusText,
      request: { url: url.href, method: event.req.method, headers: event.req.headers },
    }),
  };
}
