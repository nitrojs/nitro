import type { TLSSocket } from "node:tls";
import type { ProxyServerOptions, ProxyServer } from "httpxy";
import { createError, type H3Event } from "h3";

import { createProxyServer } from "httpxy";

export type HTTPProxy = {
  proxy: ProxyServer;
  handleEvent: (event: H3Event, opts?: ProxyServerOptions) => Promise<void>;
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

  const handleEvent = async (event: H3Event, opts: ProxyServerOptions = {}) => {
    try {
      event._handled = true;
      await proxy.web(event.node.req, event.node.res, opts);
    } catch (error: any) {
      try {
        event.node.res.setHeader("refresh", "3");
      } catch {
        // Ignore
      }
      throw createError({
        statusCode: 503,
        message: "Dev server is unavailable.",
        cause: error,
      });
    }
  };

  return {
    proxy,
    handleEvent,
  };
}
