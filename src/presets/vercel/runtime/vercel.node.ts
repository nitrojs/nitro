import "#nitro/virtual/polyfills";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { NodeServerRequest, NodeServerResponse } from "srvx";
import { NodeRequest, toNodeHandler } from "srvx/node";
import wsAdapter from "crossws/adapters/node";
import { useNitroApp, getRouteRules } from "nitro/app";
import { resolveWebsocketHooks } from "#nitro/runtime/app";
import { isrRouteRewrite } from "./isr.ts";

const nitroApp = useNitroApp();

const handler = toNodeHandler(nitroApp.fetch);
const ws = import.meta._websocket ? wsAdapter({ resolve: resolveWebsocketHooks }) : undefined;

const VERCEL_REQUEST_CONTEXT_SYMBOL = Symbol.for("@vercel/request-context");

interface VercelRequestContext {
  upgradeWebSocket?: () => {
    req: IncomingMessage;
    socket: Duplex;
    head: Buffer;
  };
}

export default async function nodeHandler(req: NodeServerRequest, res: NodeServerResponse) {
  // https://vercel.com/docs/headers/request-headers#x-forwarded-for
  // srvx node adapter uses req.socket.remoteAddress for req.ip
  let ip: string | undefined;
  Object.defineProperty(req.socket, "remoteAddress", {
    get() {
      const h = req.headers["x-forwarded-for"] as string;
      return (ip ??= h?.split?.(",").shift()?.trim());
    },
  });

  // ISR route rewrite
  const isrURL = isrRouteRewrite(req.url!, req.headers["x-now-route-matches"] as string);
  if (isrURL) {
    const { routeRules } = getRouteRules("", isrURL[0]);
    if (routeRules?.isr) {
      req.url = isrURL[0] + (isrURL[1] ? `?${isrURL[1]}` : "");
    }
  }

  if (await tryVercelRequestContextUpgrade(req, res)) {
    return;
  }

  return handler(req as any, res as any);
}

function getVercelRequestContext(): VercelRequestContext | undefined {
  const store = (globalThis as Record<symbol, unknown>)[VERCEL_REQUEST_CONTEXT_SYMBOL] as
    | { get?: () => unknown }
    | undefined;
  if (typeof store?.get !== "function") {
    return;
  }
  const context = store.get();
  if (!context || typeof context !== "object") {
    return;
  }
  return context as VercelRequestContext;
}

function isWebSocketUpgradeRequest(req: NodeServerRequest) {
  const upgrade = req.headers.upgrade;
  return (
    req.method === "GET" && typeof upgrade === "string" && upgrade.toLowerCase() === "websocket"
  );
}

async function tryVercelRequestContextUpgrade(req: NodeServerRequest, res: NodeServerResponse) {
  if (!ws || !isWebSocketUpgradeRequest(req)) {
    return false;
  }

  const context = getVercelRequestContext();
  if (typeof context?.upgradeWebSocket !== "function") {
    return false;
  }

  const upgrade = context.upgradeWebSocket();
  if (!upgrade?.req || !upgrade.socket || !upgrade.head) {
    return false;
  }

  if (typeof req.url === "string") {
    upgrade.req.url = req.url;
  }

  await ws.handleUpgrade(
    upgrade.req,
    upgrade.socket,
    upgrade.head,
    new NodeRequest({
      req: upgrade.req,
      // @ts-expect-error (upgrade is not typed)
      upgrade: {
        socket: upgrade.socket,
        head: upgrade.head,
      },
    })
  );

  if (!res.headersSent && !res.writableEnded) {
    res.statusCode = 204;
    res.end();
  }

  return true;
}
