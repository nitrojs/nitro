import { HTTPError, type HTTPEvent } from "h3";
import { getRequestURL } from "h3";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "pathe";
import consola from "consola";
import type { ErrorParser } from "youch-core";
import type { SourceMapConsumer } from "source-map";
import { defineNitroErrorHandler } from "./utils.ts";
import type { InternalHandlerResponse } from "./utils.ts";
import { FastResponse } from "srvx";
import type { NitroErrorHandler } from "nitro/types";

const errorHandler: NitroErrorHandler = defineNitroErrorHandler(
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
  await loadStackTrace(error).catch(consola.error);

  const { Youch } = await import("youch");

  // https://github.com/poppinss/youch
  const youch = new Youch();

  // Console output
  if (unhandled && !opts?.silent) {
    const ansiError = (await youch.toANSI(error)).replaceAll(process.cwd(), ".");
    consola.error(`[request error] [${event.req.method}] ${url}\n\n`, ansiError);
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
    body: await youch.toHTML(error, {
      request: {
        url: url.href,
        method: event.req.method,
        headers: Object.fromEntries(event.req.headers.entries()),
      },
    }),
  };
}

// ---- Source Map support ----

export async function loadStackTrace(error: any): Promise<void> {
  if (!(error instanceof Error)) {
    return;
  }

  const { ErrorParser } = await import("youch-core");

  const consumerCache = new Map<string, Promise<SourceMapConsumer | undefined>>();
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

  const stack = error.message + "\n" + parsed.frames.map((frame) => fmtFrame(frame)).join("\n");

  Object.defineProperty(error, "stack", { value: stack });

  if (error.cause) {
    await loadStackTrace(error.cause).catch(consola.error);
  }
}

type SourceLoader = Parameters<ErrorParser["defineSourceLoader"]>[0];
type StackFrame = Parameters<SourceLoader>[0];
async function loadConsumer(
  fileName: string,
  cache: Map<string, Promise<SourceMapConsumer | undefined>>
): Promise<SourceMapConsumer | undefined> {
  const cached = cache.get(fileName);
  if (cached) {
    return cached;
  }
  const promise = (async () => {
    const rawSourceMap = await readFile(`${fileName}.map`, "utf8").catch(() => {});
    if (!rawSourceMap) {
      return undefined;
    }
    const { SourceMapConsumer } = await import("source-map");
    return new SourceMapConsumer(rawSourceMap);
  })().catch(() => undefined);
  cache.set(fileName, promise);
  return promise;
}

async function sourceLoader(
  frame: StackFrame,
  consumerCache: Map<string, Promise<SourceMapConsumer | undefined>>
) {
  if (!frame.fileName || frame.fileType !== "fs" || frame.type === "native") {
    return;
  }

  if (frame.type === "app") {
    // A bundled dev server ships one large `.mjs.map`; keep the consumer keyed on
    // the bundle path so it is parsed once per request rather than once per frame.
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
      // Some bundler-generated maps trip the source-map wasm decoder; degrade to
      // the un-enhanced frame instead of throwing for every frame.
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
