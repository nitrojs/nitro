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

export async function fetchAddress(
  addr: { port?: number; host?: string; socketPath?: string },
  input: string | URL | Request,
  inputInit?: RequestInit
) {
  let url: URL;
  let init: (RequestInit & { duplex?: string }) | undefined;
  if (input instanceof Request) {
    url = new URL(input.url);
    init = {
      method: input.method,
      headers: input.headers,
      body: input.body,
      ...inputInit,
    };
  } else {
    url = new URL(input);
    init = inputInit;
  }
  init = {
    duplex: "half",
    redirect: "manual",
    ...init,
  };
  let res: Response;
  if (addr.socketPath) {
    url.protocol = "http:";
    res = await fetch(url, {
      ...init,
      ...fetchSocketOptions(addr.socketPath),
    });
  } else {
    const origin = `http://${addr.host}${addr.port ? `:${addr.port}` : ""}`;
    const outURL = new URL(url.pathname + url.search, origin);
    res = await fetch(outURL, init);
  }
  const headers = new Headers(res.headers);
  headers.delete("transfer-encoding");
  headers.delete("keep-alive");
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

function fetchSocketOptions(socketPath: string) {
  if ("Bun" in globalThis) {
    // https://bun.sh/guides/http/fetch-unix
    return { unix: socketPath };
  }
  if ("Deno" in globalThis) {
    // https://github.com/denoland/deno/pull/29154
    return {
      // @ts-ignore
      client: Deno.createHttpClient({
        // @ts-ignore Missing types?
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
