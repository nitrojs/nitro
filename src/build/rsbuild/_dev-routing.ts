import type { Nitro } from "nitro/types";
import type { IncomingMessage } from "node:http";
import { withBase } from "ufo";
import { ASSET_EXT_RE } from "../../utils/regex.ts";

export interface DevApp {
  hasRoute(method: string, path: string): boolean;
}

/** Whether a request matches a Nitro route other than a root catch-all (or a dev app route). */
export function isExplicitRoute(nitro: Nitro, devApp: DevApp, req: IncomingMessage): boolean {
  const method = req.method || "GET";
  const pathname = new URL(withBase(req.url!, nitro.options.baseURL), "http://localhost").pathname;
  let match = nitro.routing.routes.match(method, pathname);
  if (method === "HEAD" && !(match && !Array.isArray(match) && match.method)) {
    match = nitro.routing.routes.match("GET", pathname);
  }
  const handlers = match ? (Array.isArray(match) ? match : [match]) : [];
  return (
    handlers.some((h) => h?.route && !isCatchAllRoute(h.route)) || devApp.hasRoute(method, pathname)
  );
}

/** Whether a request is a page navigation (`GET` for HTML, without a file extension or `.html`). */
export function isPageRequest(req: IncomingMessage): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return false;
  }
  const fetchDest = req.headers["sec-fetch-dest"];
  const accept = req.headers.accept || "";
  if (fetchDest ? fetchDest !== "document" : !accept.includes("text/html")) {
    return false;
  }
  const pathname = req.url!.split(/[?#]/, 1)[0]!;
  return !/\.[a-z0-9]+$/i.test(pathname) || pathname.endsWith(".html");
}

/**
 * Whether a request is an asset load (a concrete `Sec-Fetch-Dest` other than a document, or an asset
 * extension without `text/html` accepted). A catch-all answering it with a page means the asset is
 * missing (same heuristics as `nitro/vite`).
 */
export function isAssetRequest(req: IncomingMessage): boolean {
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    return false;
  }
  const fetchDest = req.headers["sec-fetch-dest"];
  if (typeof fetchDest === "string" && fetchDest !== "empty") {
    return !/^(?:document|iframe|frame)$/.test(fetchDest);
  }
  const ext = req.url!.split(/[?#]/, 1)[0]!.match(/\.([a-z0-9]+)$/i)?.[1];
  return !!ext && ASSET_EXT_RE.test(ext) && !/\btext\/html\b/.test(req.headers.accept || "");
}

function isCatchAllRoute(route: string) {
  return route === "/**" || route.startsWith("/**:") || /^\/:\w+\(\.\*\)$/.test(route);
}
