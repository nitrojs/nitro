import type { IncomingMessage, OutgoingMessage } from "node:http";
import type { TLSSocket } from "node:tls";
import type { ProxyServerOptions, ProxyServer } from "httpxy";
import type { H3Event } from "h3";

import { createProxyServer } from "httpxy";
import { HTTPError, fromNodeHandler } from "h3";
import { Agent } from "undici";

export type HTTPProxy = {
  proxy: ProxyServer;
  handleEvent: (event: H3Event, opts?: ProxyServerOptions) => any;
};

export function createHTTPProxy(defaults: ProxyServerOptions = {}): HTTPProxy {
  const proxy = createProxyServer(defaults);

  proxy.on("proxyReq", (proxyReq, req) => {
    if (!proxyReq.hasHeader("x-forwarded-for")) {
      const address = req.socket.remoteAddress;
      if (address) {
        proxyReq.appendHeader("x-forwarded-for", address);
      }
    }
    if (!proxyReq.hasHeader("x-forwarded-port")) {
      const localPort = req?.socket?.localPort;
      if (localPort) {
        proxyReq.setHeader("x-forwarded-port", req.socket.localPort);
      }
    }
    if (!proxyReq.hasHeader("x-forwarded-Proto")) {
      const encrypted = (req?.connection as TLSSocket)?.encrypted;
      proxyReq.setHeader("x-forwarded-proto", encrypted ? "https" : "http");
    }
  });

  return {
    proxy,
    async handleEvent(event, opts) {
      try {
        return await fromNodeHandler((req, res) =>
          proxy.web(req as IncomingMessage, res as OutgoingMessage, opts)
        )(event);
      } catch (error: any) {
        event.res.headers.set("refresh", "3");
        throw new HTTPError({
          status: 503,
          message: "Dev server is unavailable.",
          cause: error,
        });
      }
    },
  };
}

export function fetchAddress(
  req: Request,
  addr: { host: string; port?: number; socketPath?: string }
): Promise<Response> {
  const reqURL = new URL(req.url);

  const outURL = new URL(
    reqURL.pathname + reqURL.search,
    `http://${addr.host || reqURL.hostname}${addr.port ? `:${addr.port}` : ""}`
  );

  return globalThis.fetch(outURL, {
    method: req.method,
    headers: req.headers,
    body: req.body,
    redirect: "manual",
    // @ts-expect-error undici
    duplex: "half",
    ...fetchSocketOptions(addr.socketPath),
  });
}

function fetchSocketOptions(socketPath: string | undefined) {
  if (!socketPath) {
    return {};
  }
  if ("Bun" in globalThis) {
    // https://bun.sh/guides/http/fetch-unix
    return { unix: socketPath };
  }
  if ("Deno" in globalThis) {
    // https://github.com/denoland/deno/pull/29154
    return {
      client: Deno.createHttpClient({
        // @ts-expect-error Missing types?
        transport: "unix",
        path: socketPath,
      }),
    };
  }
  // https://github.com/nodejs/undici/issues/2970
  return {
    dispatcher: new Agent({ connect: { socketPath } }),
  };
}
