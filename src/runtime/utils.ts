// Backward compatibility for imports from "#internal/nitro/*" or "nitropack/runtime/*"
import type { H3Event } from "h3";
import { getRequestHeader } from "h3";

/**
 * @deprecated This util is only provided for backward compatibility and will be removed in v3.
 */
export function isJsonRequest(event: H3Event) {
  // If the client specifically requests HTML, then avoid classifying as JSON.
  if (hasReqHeader(event, "accept", "text/html")) {
    return false;
  }
  return (
    hasReqHeader(event, "accept", "application/json") ||
    hasReqHeader(event, "user-agent", "curl/") ||
    hasReqHeader(event, "user-agent", "httpie/") ||
    hasReqHeader(event, "sec-fetch-mode", "cors") ||
    event.path.startsWith("/api/") ||
    event.path.endsWith(".json")
  );
}

/**
 * Internal
 */
function hasReqHeader(event: H3Event, name: string, includes: string) {
  const value = getRequestHeader(event, name);
  return (
    value && typeof value === "string" && value.toLowerCase().includes(includes)
  );
}

/**
 * @deprecated This util is only provided for backward compatibility and will be removed in v3.
 */
export function normalizeError(error: any, isDev?: boolean) {
  // temp fix for https://github.com/nitrojs/nitro/issues/759
  // TODO: investigate vercel-edge not using unenv pollyfill
  const cwd = typeof process.cwd === "function" ? process.cwd() : "/";

  const stack =
    !isDev && !import.meta.prerender && (error.unhandled || error.fatal)
      ? []
      : ((error.stack as string) || "")
          .split("\n")
          .splice(1)
          .filter((line) => line.includes("at "))
          .map((line) => {
            const text = line
              .replace(cwd + "/", "./")
              .replace("webpack:/", "")
              .replace("file://", "")
              .trim();
            return {
              text,
              internal:
                (line.includes("node_modules") && !line.includes(".cache")) ||
                line.includes("internal") ||
                line.includes("new Promise"),
            };
          });

  const statusCode = error.statusCode || 500;
  const statusMessage =
    error.statusMessage ?? (statusCode === 404 ? "Not Found" : "");
  const message =
    !isDev && error.unhandled
      ? "internal server error"
      : error.message || error.toString();

  return {
    stack,
    statusCode,
    statusMessage,
    message,
  };
}
