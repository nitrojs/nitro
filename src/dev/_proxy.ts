import type { IncomingMessage, ServerResponse } from "node:http";
import type { Socket } from "node:net";
import type { H3Event } from "h3";
import type { Hooks, Peer } from "crossws";
import type { ProxyAddr, ProxyServerOptions, ProxyTarget } from "httpxy";
import { createProxyServer, proxyFetch } from "httpxy";
import { createWebSocketProxy } from "crossws";
import { fromNodeHandler, HTTPError } from "h3";
import { joinURL } from "ufo";

export type DevProxy = ReturnType<typeof createDevProxy>;

/**
 * Create a `devProxy` rule handler.
 *
 * Node.js requests are proxied with the full `httpxy` proxy server. Other runtimes (Bun, Deno, ...)
 * use web-standard `proxyFetch` for HTTP and a terminating `crossws` proxy for WebSockets.
 */
export function createDevProxy(defaults: ProxyServerOptions = {}) {
  const opts: ProxyServerOptions = { xfwd: true, ...defaults };
  const proxy = createProxyServer(opts);
  const nodeHandler = fromNodeHandler((req, res) =>
    proxy.web(req as IncomingMessage, res as ServerResponse)
  );
  let wsHooks: Partial<Hooks> | undefined;
  return {
    proxy,
    async handleEvent(event: H3Event) {
      try {
        if (event.runtime?.node?.res) {
          return await nodeHandler(event);
        }
        return await proxyWebRequest(event.req as Request, opts);
      } catch (error: any) {
        event.res.headers.set("refresh", "3");
        throw new HTTPError({
          status: 503,
          message: "Dev server is unavailable.",
          cause: error,
        });
      }
    },
    proxyUpgrade(req: IncomingMessage, socket: Socket, head: any) {
      return proxy.ws(req, socket, {}, head);
    },
    get websocket(): Partial<Hooks> {
      return (wsHooks ??= createWebSocketProxy({
        target: (peer) => resolveUpstreamURL(opts, peer.request.url, "ws"),
        headers: (peer) => forwardHeaders(peer, opts),
      }));
    },
  };
}

/**
 * Create `crossws` hooks proxying WebSocket connections to the worker address resolved by `getAddress`.
 */
export function createWorkerWebSocketProxy(
  getAddress: () => ProxyAddr | undefined | Promise<ProxyAddr | undefined>
): Partial<Hooks> {
  return createWebSocketProxy({
    target: async (peer) => {
      const addr = await getAddress();
      if (!addr) {
        throw new Error("Dev worker address is unavailable.");
      }
      const { pathname, search } = new URL(peer.request.url);
      return addr.socketPath
        ? `ws+unix://${addr.socketPath}:${pathname}${search}`
        : `ws://${formatHost(addr.host || "localhost")}:${addr.port}${pathname}${search}`;
    },
    headers: (peer) => forwardHeaders(peer, { xfwd: true }),
  });
}

function proxyWebRequest(req: Request, opts: ProxyServerOptions) {
  const target = parseTarget(opts.target);
  const upstreamURL = new URL(resolveUpstreamURL(opts, req.url, "http"));
  const input = new URL(upstreamURL.pathname + upstreamURL.search, req.url);
  const headers = new Headers(req.headers);
  for (const [key, value] of Object.entries(opts.headers || {})) {
    headers.set(key, value);
  }
  if (opts.auth) {
    headers.set("authorization", `Basic ${btoa(opts.auth)}`);
  }
  return proxyFetch(
    target.socketPath ? { socketPath: target.socketPath } : upstreamURL.origin,
    input,
    { method: req.method, headers, body: req.body, signal: req.signal },
    {
      xfwd: opts.xfwd,
      changeOrigin: opts.changeOrigin,
      followRedirects: opts.followRedirects,
      timeout: opts.proxyTimeout,
      agent: opts.agent,
      ssl: opts.secure === false ? { ...opts.ssl, rejectUnauthorized: false } : opts.ssl,
    }
  );
}

function resolveUpstreamURL(opts: ProxyServerOptions, reqURL: string, scheme: "http" | "ws") {
  const target = parseTarget(opts.target);
  const { pathname, search } = new URL(reqURL);
  const path = opts.ignorePath ? "" : pathname + search;
  const fullPath = opts.prependPath === false ? path || "/" : joinURL(target.url.pathname, path);
  if (target.socketPath) {
    return scheme === "ws"
      ? `ws+unix://${target.socketPath}:${fullPath}`
      : `http://localhost${fullPath}`;
  }
  const protocol =
    scheme === "ws" ? target.url.protocol.replace(/^http/, "ws") : target.url.protocol;
  return `${protocol}//${target.url.host}${fullPath}`;
}

function parseTarget(target: ProxyTarget | undefined): { url: URL; socketPath?: string } {
  if (!target) {
    throw new Error("[nitro] `devProxy` rule is missing a `target`.");
  }
  if (typeof target === "string" || target instanceof URL) {
    return { url: new URL(target) };
  }
  const protocol = target.protocol || "http:";
  const hostname = formatHost(target.hostname || target.host || "localhost");
  const port = target.port ? `:${target.port}` : "";
  return {
    url: new URL(`${protocol}//${hostname}${port}${target.pathname || ""}`),
    socketPath: target.socketPath,
  };
}

const skipHeaders = new Set([
  "host",
  "connection",
  "upgrade",
  "keep-alive",
  "transfer-encoding",
  "sec-websocket-key",
  "sec-websocket-version",
  "sec-websocket-extensions",
  "sec-websocket-protocol",
  "sec-websocket-accept",
]);

function forwardHeaders(peer: Peer, opts: Pick<ProxyServerOptions, "headers" | "xfwd" | "auth">) {
  const headers: Record<string, string> = {};
  for (const [key, value] of peer.request.headers) {
    if (!skipHeaders.has(key)) {
      headers[key] = value;
    }
  }
  if (opts.xfwd) {
    const url = new URL(peer.request.url);
    headers["x-forwarded-for"] ??= peer.remoteAddress || "";
    headers["x-forwarded-port"] ??= url.port || (url.protocol === "https:" ? "443" : "80");
    headers["x-forwarded-proto"] ??= url.protocol === "https:" ? "wss" : "ws";
    headers["x-forwarded-host"] ??= url.host;
  }
  if (opts.auth) {
    headers.authorization = `Basic ${btoa(opts.auth)}`;
  }
  return { ...headers, ...opts.headers };
}

function formatHost(host: string) {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}
