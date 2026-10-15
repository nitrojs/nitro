import {
  type H3Event,
  type H3Error,
  send,
  getRequestHeader,
  getRequestHeaders,
  getRequestURL,
  getResponseHeader,
  setResponseHeaders,
  setResponseStatus,
} from "h3";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import consola from "consola";
import { ErrorParser } from "youch-core";
import { Youch } from "youch";
import { SourceMapConsumer } from "source-map";
import { defineNitroErrorHandler, type InternalHandlerResponse } from "./utils";

export default defineNitroErrorHandler(
  async function defaultNitroErrorHandler(error, event) {
    const res = await defaultHandler(error, event);
    if (!event.node?.res.headersSent) {
      // https://github.com/nitrojs/nitro/pull/3249
      setResponseHeaders(event, res.headers!);
    }
    setResponseStatus(event, res.status, res.statusText);
    return send(
      event,
      typeof res.body === "string"
        ? res.body
        : JSON.stringify(res.body, null, 2)
    );
  }
);

export async function defaultHandler(
  error: H3Error,
  event: H3Event,
  opts?: { silent?: boolean; json?: boolean }
): Promise<InternalHandlerResponse> {
  const isSensitive = error.unhandled || error.fatal;
  const statusCode = error.statusCode || 500;
  const statusMessage = error.statusMessage || "Server Error";
  // prettier-ignore
  const url = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true });

  // Redirects with base URL
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

  // Load stack trace with source maps
  await loadStackTrace(error).catch(consola.error);

  // https://github.com/poppinss/youch
  const youch = new Youch();

  // Console output
  if (isSensitive && !opts?.silent) {
    // prettier-ignore
    const tags = [error.unhandled && "[unhandled]", error.fatal && "[fatal]"].filter(Boolean).join(" ");
    const ansiError = await (
      await youch.toANSI(error)
    ).replaceAll(process.cwd(), ".");
    consola.error(
      `[request error] ${tags} [${event.method}] ${url}\n\n`,
      ansiError
    );
  }

  // Use HTML response only when user-agent expects it (browsers)
  const useJSON =
    opts?.json ?? !getRequestHeader(event, "accept")?.includes("text/html");

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
  if (statusCode === 404 || !getResponseHeader(event, "cache-control")) {
    headers["cache-control"] = "no-cache";
  }

  // Prepare body
  const body = useJSON
    ? {
        error: true,
        url,
        statusCode,
        statusMessage,
        message: error.message,
        data: error.data,
        stack: error.stack?.split("\n").map((line) => line.trim()),
      }
    : await youch.toHTML(error, {
        request: {
          url: url.href,
          method: event.method,
          headers: getRequestHeaders(event),
        },
      });

  return {
    status: statusCode,
    statusText: statusMessage,
    headers,
    body,
  };
}

// ---- Source Map support ----

export async function loadStackTrace(error: any) {
  if (!(error instanceof Error)) {
    return;
  }
  const consumerCache: ConsumerCache = new Map();
  let parsed: Awaited<ReturnType<ErrorParser["parse"]>>;
  try {
    parsed = await new ErrorParser()
      .defineSourceLoader((frame) => sourceLoader(frame, consumerCache))
      .parse(error);
  } finally {
    for (const consumer of consumerCache.values()) {
      await consumer.then((c) => c?.destroy()).catch(() => {});
    }
  }

  const stack =
    error.message +
    "\n" +
    parsed.frames.map((frame) => fmtFrame(frame)).join("\n");

  Object.defineProperty(error, "stack", { value: stack });

  if (error.cause) {
    await loadStackTrace(error.cause).catch(consola.error);
  }
}

type SourceLoader = Parameters<ErrorParser["defineSourceLoader"]>[0];
type StackFrame = Parameters<SourceLoader>[0];
type ConsumerCache = Map<string, Promise<SourceMapConsumer | undefined>>;

function loadConsumer(
  fileName: string,
  cache: ConsumerCache
): Promise<SourceMapConsumer | undefined> {
  const cached = cache.get(fileName);
  if (cached) {
    return cached;
  }
  const promise = (async () => {
    const rawSourceMap = await readFile(`${fileName}.map`, "utf8").catch(
      () => {}
    );
    if (!rawSourceMap) {
      return undefined;
    }
    return await new SourceMapConsumer(rawSourceMap);
  })().catch(() => undefined);
  cache.set(fileName, promise);
  return promise;
}

async function sourceLoader(frame: StackFrame, consumerCache: ConsumerCache) {
  if (!frame.fileName || frame.fileType !== "fs" || frame.type === "native") {
    return;
  }

  if (frame.type === "app") {
    // The dev bundle ships one large `.mjs.map`; keep the consumer keyed on the
    // bundle path so it is parsed once per error rather than once per frame.
    const bundleFileName = frame.fileName;
    try {
      const consumer = await loadConsumer(bundleFileName, consumerCache);
      if (consumer) {
        // prettier-ignore
        const originalPosition = consumer.originalPositionFor({ line: frame.lineNumber!, column: frame.columnNumber! });
        if (originalPosition.source && originalPosition.line) {
          // prettier-ignore
          frame.fileName = resolve(dirname(bundleFileName), originalPosition.source);
          frame.lineNumber = originalPosition.line;
          frame.columnNumber = originalPosition.column || 0;
        }
      }
    } catch {
      // Some bundler-generated maps trip the source-map wasm decoder; degrade
      // to the un-enhanced frame instead of throwing for every frame.
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
