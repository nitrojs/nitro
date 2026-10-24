import type { IncomingMessage, ServerResponse } from "node:http";
import type { Socket } from "node:net";
import type { H3Event } from "h3";
import type { Hooks, Peer, WebSocketProxyOptions } from "crossws";
import type { ProxyAddr, ProxyServerOptions, ProxyTarget } from "httpxy";
import { createProxyServer, proxyFetch } from "httpxy";
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
  let wsHooks: Promise<Partial<Hooks>> | undefined;
  return {
    proxy,
    async handleEvent(event: H3Event) {
      try {
        if (event.runtime?.node?.res) {
          return await nodeHandler(event);
        }
        return await proxyWebRequest(event.req as Request & { ip?: string }, opts);
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
    /** Resolve `crossws` hooks proxying WebSocket connections to the rule target. */
    websocket(): Promise<Partial<Hooks>> {
      return (wsHooks ??= createWebSocketProxy({
        target: (peer) => {
          const target = parseTarget(opts.target);
          const path = resolveUpstreamPath(opts, target, new URL(peer.request.url));
          return target.socketPath
            ? `ws+unix://${target.socketPath}:${path}`
            : `${target.url.protocol.replace(/^http/, "ws")}//${target.url.host}${path}`;
        },
        headers: (peer) => {
          const headers = forwardHeaders(peer.request.headers);
          if (opts.xfwd) {
            setForwardedHeaders(headers, {
              url: peer.request.url,
              ip: peer.remoteAddress,
              ws: true,
            });
          }
          for (const [key, value] of Object.entries(opts.headers || {})) {
            headers.set(key, value);
          }
          setBasicAuth(headers, opts.auth);
          return Object.fromEntries(headers);
        },
      }));
    },
  };
}

/**
 * Create a resolver of `crossws` hooks proxying WebSocket connections to the dev worker.
 *
 * The handshake is rejected (`503`) when the worker has no address to dial, e.g. while it failed
 * to start or for runners that only support upgrades from a Node.js host (`miniflare`, `self`).
 *
 * `track` is called with the dialed address once the upstream connects, and the function it
 * returns once the proxied connection ends (throwing closes the peer with `1011`).
 */
export function createWorkerWebSocketProxy(
  getAddress: () => ProxyAddr | undefined | Promise<ProxyAddr | undefined>,
  opts: { track?: (addr: ProxyAddr) => (() => void) | undefined } = {}
): () => Promise<Partial<Hooks>> {
  let hooks: Promise<Partial<Hooks>> | undefined;
  const dialed = new WeakMap<Peer, ProxyAddr>();
  const settles = new WeakMap<Peer, () => void>();
  const { track } = opts;
  return () =>
    (hooks ??= createWebSocketProxy({
      target: async (peer) => {
        const addr = await resolveWorkerAddress(getAddress);
        dialed.set(peer, addr);
        const { pathname, search } = new URL(peer.request.url);
        return addr.socketPath
          ? `ws+unix://${addr.socketPath}:${pathname}${search}`
          : `ws://${formatHost(addr.host || "localhost")}:${addr.port}${pathname}${search}`;
      },
      headers: (peer) => {
        const headers = forwardHeaders(peer.request.headers);
        setForwardedHeaders(headers, {
          url: peer.request.url,
          ip: peer.remoteAddress,
          ws: true,
          append: true,
        });
        return Object.fromEntries(headers);
      },
      onUpstreamConnect:
        track &&
        ((peer) => {
          const settle = track(dialed.get(peer)!);
          if (settle) {
            settles.set(peer, settle);
          }
        }),
      onUpstreamClose:
        track &&
        ((peer) => {
          settles.get(peer)?.();
          settles.delete(peer);
        }),
    }).then((proxy) => ({
      ...proxy,
      async upgrade(request) {
        try {
          await resolveWorkerAddress(getAddress);
        } catch (error) {
          return new Response(error instanceof Error ? error.message : String(error), {
            status: 503,
          });
        }
        return proxy.upgrade?.(request);
      },
    })));
}

async function createWebSocketProxy(opts: WebSocketProxyOptions) {
  // Lazy loaded: only non-Node.js listeners proxy WebSockets through crossws
  const { createWebSocketProxy } = await import("crossws");
  return createWebSocketProxy(opts);
}

async function resolveWorkerAddress(
  getAddress: () => ProxyAddr | undefined | Promise<ProxyAddr | undefined>
): Promise<ProxyAddr> {
  const addr = await getAddress();
  if (!addr?.socketPath && !addr?.port) {
    throw new Error(
      "Dev worker has no address to proxy WebSocket upgrades to. Some runners only support upgrades when the dev server runs on Node.js."
    );
  }
  return addr;
}

function proxyWebRequest(req: Request & { ip?: string }, opts: ProxyServerOptions) {
  const target = parseTarget(opts.target);
  const url = new URL(req.url);
  const headers = new Headers(req.headers);
  if (opts.xfwd) {
    setForwardedHeaders(headers, { url, ip: req.ip });
  }
  for (const [key, value] of Object.entries(opts.headers || {})) {
    headers.set(key, value);
  }
  setBasicAuth(headers, opts.auth);
  const ssl =
    target.tls || opts.ssl || opts.secure === false
      ? { ...target.tls, ...opts.ssl, ...(opts.secure === false && { rejectUnauthorized: false }) }
      : undefined;
  return proxyFetch(
    target.addr,
    url.origin + resolveUpstreamPath(opts, target, url),
    { method: req.method, headers, body: req.body, signal: req.signal },
    {
      changeOrigin: opts.changeOrigin,
      followRedirects: opts.followRedirects,
      timeout: opts.proxyTimeout,
      agent: opts.agent,
      ssl,
    }
  );
}

interface ParsedTarget {
  url: URL;
  addr: string | ProxyAddr;
  socketPath?: string;
  tls?: Record<string, unknown>;
}

const tlsKeys = ["key", "passphrase", "pfx", "cert", "ca", "ciphers", "secureProtocol"] as const;

function parseTarget(target: ProxyTarget | undefined): ParsedTarget {
  if (!target) {
    throw new Error("[nitro] `devProxy` rule is missing a `target`.");
  }
  let url: URL;
  let socketPath: string | undefined;
  let tls: Record<string, unknown> | undefined;
  if (typeof target === "string" || target instanceof URL) {
    url = new URL(target);
  } else {
    const protocol = target.protocol ? target.protocol.replace(/:?$/, ":") : "http:";
    const hostname = formatHost(target.hostname || target.host || "localhost");
    const port = target.port ? `:${target.port}` : "";
    url = new URL(`${protocol}//${hostname}${port}${target.pathname || ""}`);
    socketPath = target.socketPath;
    for (const key of tlsKeys) {
      if (target[key] !== undefined) {
        (tls ??= {})[key] = target[key];
      }
    }
  }
  const secure = /^(?:https|wss):$/.test(url.protocol);
  // `proxyFetch` only detects HTTPS from string addresses, and only parses non-IPv6 ones
  const addr: string | ProxyAddr = socketPath
    ? { socketPath }
    : secure
      ? url.origin
      : { host: url.hostname.replace(/^\[(.*)\]$/, "$1"), port: Number(url.port) || 80 };
  return { url, addr, socketPath, tls };
}

/** Upstream path (with query), following `httpxy` semantics for `prependPath` and `ignorePath`. */
function resolveUpstreamPath(opts: ProxyServerOptions, target: ParsedTarget, reqURL: URL) {
  const prepend = opts.prependPath !== false;
  const reqPath = opts.ignorePath ? "" : reqURL.pathname + reqURL.search;
  let path = joinURL(prepend ? target.url.pathname : "", reqPath) || "/";
  const targetSearch = prepend ? target.url.search : "";
  if (targetSearch) {
    path = path.includes("?") ? path.replace("?", `${targetSearch}&`) : path + targetSearch;
  }
  return path;
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

function forwardHeaders(input: Headers) {
  const headers = new Headers();
  for (const [key, value] of input) {
    if (!skipHeaders.has(key)) {
      headers.append(key, value);
    }
  }
  return headers;
}

function setForwardedHeaders(
  headers: Headers,
  opts: { url: string | URL; ip?: string; ws?: boolean; append?: boolean }
) {
  const url = typeof opts.url === "string" ? new URL(opts.url) : opts.url;
  const secure = /^(?:https|wss):$/.test(url.protocol);
  const values = {
    for: opts.ip,
    port: url.port || (secure ? "443" : "80"),
    proto: opts.ws ? (secure ? "wss" : "ws") : secure ? "https" : "http",
  };
  for (const [key, value] of Object.entries(values)) {
    const name = `x-forwarded-${key}`;
    const existing = headers.get(name);
    if (value === undefined || (existing && !opts.append)) {
      continue;
    }
    headers.set(name, existing ? `${existing},${value}` : value);
  }
  if (!opts.ws && !headers.has("x-forwarded-host")) {
    headers.set("x-forwarded-host", url.host);
  }
}

function setBasicAuth(headers: Headers, auth: string | undefined) {
  if (auth && !headers.has("authorization")) {
    const bytes = new TextEncoder().encode(auth);
    headers.set("authorization", `Basic ${btoa(String.fromCharCode(...bytes))}`);
  }
}

function formatHost(host: string) {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}
