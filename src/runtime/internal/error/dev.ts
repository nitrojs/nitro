import type { H3Event, HTTPError, HTTPEvent } from "h3";
import { getRequestURL } from "h3";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import consola from "consola";
import { ErrorParser } from "youch-core";
import { Youch } from "youch";
import { SourceMapConsumer } from "source-map";
import { defineNitroErrorHandler } from "./utils.ts";
import type { InternalHandlerResponse } from "./utils.ts";
import { FastResponse } from "srvx";

export default defineNitroErrorHandler(async function defaultNitroErrorHandler(error, event) {
  const res = await defaultHandler(error, event);
  return new FastResponse(
    typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2),
    res
  );
});

export async function defaultHandler(
  error: HTTPError,
  event: HTTPEvent,
  opts?: { silent?: boolean; json?: boolean }
): Promise<InternalHandlerResponse> {
  const isSensitive = error.unhandled;
  const status = error.status || 500;
  // prettier-ignore
  const url = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true })

  // Redirects with base URL
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

  // Load stack trace with source maps
  await loadStackTrace(error).catch(consola.error);

  // https://github.com/poppinss/youch
  const youch = new Youch();

  // Console output
  if (isSensitive && !opts?.silent) {
    // prettier-ignore
    const tags = [error.unhandled && "[unhandled]"].filter(Boolean).join(" ")
    const ansiError = await (await youch.toANSI(error)).replaceAll(process.cwd(), ".");
    consola.error(`[request error] ${tags} [${event.req.method}] ${url}\n\n`, ansiError);
  }

  // Use HTML response only when user-agent expects it (browsers)
  const useJSON = opts?.json ?? !event.req.headers.get("accept")?.includes("text/html");

  // Prepare headers
  const headers: HeadersInit = {
    "content-type": useJSON ? "application/json" : "text/html",
    // Prevent browser from guessing the MIME types of resources.
    "x-content-type-options": "nosniff",
    // Prevent error page from being embedded in an iframe
    "x-frame-options": "DENY",
    // Prevent browsers from sending the Referer header
    "referrer-policy": "no-referrer",
    // Disable the execution of any js
    "content-security-policy":
      "script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self';",
  };

  if (status === 404 || !(event as H3Event).res.headers.has("cache-control")) {
    headers["cache-control"] = "no-cache";
  }

  // Prepare body
  const body = useJSON
    ? {
        error: true,
        url,
        status,
        statusText: error.statusText,
        message: error.message,
        data: error.data,
        ...error.body,
        stack: error.stack?.split("\n").map((line) => line.trim()),
      }
    : await youch.toHTML(error, {
        request: {
          url: url.href,
          method: event.req.method,
          headers: Object.fromEntries(event.req.headers.entries()),
        },
      });

  return {
    status,
    statusText: error.statusText,
    headers,
    body,
  };
}

// ---- Source Map support ----

export async function loadStackTrace(error: any) {
  if (!(error instanceof Error)) {
    return;
  }
  const parsed = await new ErrorParser().defineSourceLoader(sourceLoader).parse(error);

  const stack = error.message + "\n" + parsed.frames.map((frame) => fmtFrame(frame)).join("\n");

  Object.defineProperty(error, "stack", { value: stack });

  if (error.cause) {
    await loadStackTrace(error.cause).catch(consola.error);
  }
}

type SourceLoader = Parameters<ErrorParser["defineSourceLoader"]>[0];
type StackFrame = Parameters<SourceLoader>[0];
async function sourceLoader(frame: StackFrame) {
  if (!frame.fileName || frame.fileType !== "fs" || frame.type === "native") {
    return;
  }

  if (frame.type === "app") {
    // prettier-ignore
    const rawSourceMap = await readFile(`${frame.fileName}.map`, "utf8").catch(() => {});
    if (rawSourceMap) {
      const consumer = await new SourceMapConsumer(rawSourceMap);
      // prettier-ignore
      const originalPosition = consumer.originalPositionFor({ line: frame.lineNumber!, column: frame.columnNumber! });
      if (originalPosition.source && originalPosition.line) {
        // prettier-ignore
        frame.fileName = resolve(dirname(frame.fileName), originalPosition.source);
        frame.lineNumber = originalPosition.line;
        frame.columnNumber = originalPosition.column || 0;
      }
    }
  }

  const contents = await readFile(frame.fileName, "utf8").catch(() => {});
  return contents ? { contents } : undefined;
}

function fmtFrame(frame: StackFrame) {
  if (frame.type === "native") {
    return frame.raw;
  }
  const src = `${frame.fileName || ""}:${frame.lineNumber}:${frame.columnNumber})`;
  return frame.functionName ? `at ${frame.functionName} (${src}` : `at ${src}`;
}
