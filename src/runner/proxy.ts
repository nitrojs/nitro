import type { IncomingMessage, RequestOptions, ServerResponse } from "node:http";
import type { TLSSocket } from "node:tls";
import type { ProxyServerOptions, ProxyServer } from "httpxy";
import type { H3Event } from "h3";

import { request as httpRequest } from "node:http";
import { Readable } from "node:stream";
import { createProxyServer } from "httpxy";
import { HTTPError, fromNodeHandler } from "h3";

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
        proxyReq.setHeader("x-forwarded-port", localPort);
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
          proxy.web(req as IncomingMessage, res as ServerResponse, opts)
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

// Tests in @test/unit/proxy.test.ts
export async function fetchAddress(
  addr: { port?: number; host?: string; socketPath?: string },
  input: string | URL | Request,
  inputInit?: RequestInit
) {
  let url: URL;
  let init: RequestInit | undefined;
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
    redirect: "manual",
    ...init,
  };

  const path = url.pathname + url.search;
  const reqHeaders: Record<string, string> = {};
  if (init.headers) {
    const h =
      init.headers instanceof Headers ? init.headers : new Headers(init.headers as HeadersInit);
    for (const [key, value] of h) {
      reqHeaders[key] = value;
    }
  }

  const res = await new Promise<IncomingMessage>((resolve, reject) => {
    const reqOpts: RequestOptions = {
      method: init!.method || "GET",
      path,
      headers: reqHeaders,
    };

    if (addr.socketPath) {
      reqOpts.socketPath = addr.socketPath;
    } else {
      reqOpts.hostname = addr.host || "localhost";
      reqOpts.port = addr.port;
    }

    const req = httpRequest(reqOpts, resolve);
    req.on("error", reject);

    if (init!.body instanceof ReadableStream) {
      Readable.fromWeb(init!.body as import("node:stream/web").ReadableStream).pipe(req);
    } else if (init!.body) {
      req.end(init!.body);
    } else {
      req.end();
    }
  });

  const headers = new Headers();
  for (const [key, value] of Object.entries(res.headers)) {
    if (key === "transfer-encoding" || key === "keep-alive") {
      continue;
    }
    if (Array.isArray(value)) {
      for (const v of value) {
        headers.append(key, v);
      }
    } else if (value) {
      headers.set(key, value);
    }
  }

  const hasBody = res.statusCode !== 204 && res.statusCode !== 304;
  return new Response(hasBody ? (Readable.toWeb(res) as ReadableStream) : null, {
    status: res.statusCode,
    statusText: res.statusMessage,
    headers,
  });
}
