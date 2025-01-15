import {
  send,
  getRequestHeader,
  getRequestHeaders,
  setResponseHeader,
  setResponseStatus,
  getRequestURL,
  getResponseHeader,
} from "h3";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import consola from "consola";
import { ErrorParser } from "youch-core";
import { Youch } from "youch";
import { SourceMapConsumer } from "source-map";
import { defineNitroErrorHandler, setSecurityHeaders } from "./utils";

export default defineNitroErrorHandler(
  async function defaultNitroErrorHandler(error, event) {
    const statusCode = error.statusCode || 500;
    const statusMessage = error.statusMessage || "Server Error";
    // prettier-ignore
    const url = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).toString();

    // Load stack trace with source maps
    await loadStackTrace(error);

    // Console output
    if (error.unhandled || error.fatal) {
      // prettier-ignore
      const tags = [error.unhandled && "[unhandled]", error.fatal && "[fatal]"].filter(Boolean).join(" ")
      consola.error(
        `[nitro] [request error] ${tags} [${event.method}] ${url}\n\n`,
        error
      );
    }

    // https://github.com/poppinss/youch
    const youch = new Youch();

    // Send response
    setResponseStatus(event, statusCode, statusMessage);
    setSecurityHeaders(event, true /* allow js */);
    if (statusCode === 404 || !getResponseHeader(event, "cache-control")) {
      setResponseHeader(event, "cache-control", "no-cache");
    }
    return getRequestHeader(event, "accept")?.includes("text/html")
      ? send(
          event,
          await youch.toHTML(error, {
            request: {
              url,
              method: event.method,
              headers: getRequestHeaders(event),
            },
          }),
          "text/html"
        )
      : send(
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
        );
  }
);

// ---- Source Map support ----

export async function loadStackTrace(error: any) {
  if (!(error instanceof Error)) {
    return;
  }
  const parsed = await new ErrorParser()
    .defineSourceLoader(sourceLoader)
    .parse(error);

  const stack =
    error.message +
    "\n" +
    parsed.frames.map((frame) => fmtFrame(frame)).join("\n");
  try {
    Object.defineProperty(error, "stack", { value: stack });
  } catch {
    /* ignore */
  }
  if (error.cause) {
    await loadStackTrace(error.cause);
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
