// import ansiHTML from 'ansi-html'
import { send, setResponseHeader, setResponseStatus } from "h3";
import type { NitroErrorHandler } from "nitropack/types";
import { isJsonRequest, normalizeError } from "./utils";

export function defineNitroErrorHandler(
  handler: NitroErrorHandler
): NitroErrorHandler {
  return handler;
}

const isDev = process.env.NODE_ENV === "development";

interface ParsedError {
  url: string;
  statusCode: number;
  statusMessage: number;
  message: string;
  stack?: string[];
}

export default defineNitroErrorHandler(
  function defaultNitroErrorHandler(error, event) {
    const { stack, statusCode, statusMessage, message } = normalizeError(
      error,
      isDev
    );

    const showDetails = isDev && statusCode !== 404;

    const errorObject = {
      url: event.path || "",
      statusCode,
      statusMessage,
      message,
      stack: showDetails ? stack.map((i) => i.text) : undefined,
    };

    // Console output
    if (error.unhandled || error.fatal) {
      const tags = [
        "[nitro]",
        "[request error]",
        error.unhandled && "[unhandled]",
        error.fatal && "[fatal]",
      ]
        .filter(Boolean)
        .join(" ");
      console.error(
        tags,
        error.message + "\n" + stack.map((l) => "  " + l.text).join("  \n")
      );
    }

    if (statusCode === 404) {
      setResponseHeader(event, "Cache-Control", "no-cache");
    }

    setResponseStatus(event, statusCode, statusMessage);

    if (isJsonRequest(event)) {
      setResponseHeader(event, "Content-Type", "application/json");
      return send(event, JSON.stringify(errorObject));
    }
    setResponseHeader(event, "Content-Type", "text/html");
    return send(event, renderHTMLError(errorObject));
  }
);

function renderHTMLError(error: ParsedError): string {
  const statusCode = error.statusCode || 500;
  const statusMessage = error.statusMessage || "Request Error";
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${statusCode} ${statusMessage}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico/css/pico.min.css">
  </head>
  <body>
    <main class="container">
      <dialog open>
        <article>
          <header>
            <h2>${statusCode} ${statusMessage}</h2>
          </header>
          <code>
            ${error.message}<br><br>
            ${
              "\n" +
              (error.stack || []).map((i) => `&nbsp;&nbsp;${i}`).join("<br>")
            }
          </code>
          <footer>
            <a href="/" onclick="event.preventDefault();history.back();">Go Back</a>
          </footer>
        </article>
      </dialog>
    </main>
  </body>
</html>
`;
}
