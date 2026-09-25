import "#nitro/virtual/polyfills";
import type { NodeServerRequest, NodeServerResponse, ServerRequest } from "srvx";
import type { ServerResponse, IncomingMessage } from "node:http";
import { toNodeHandler } from "srvx/node";
import wsAdapter from "crossws/adapters/vercel";
import { useNitroApp, getRouteRules } from "nitro/app";
import { resolveWebsocketHooks } from "#nitro/runtime/app";
import { isrRouteRewrite } from "./isr.ts";

interface VercelRequestContext {
  waitUntil?: (promise: Promise<any>) => void;
}

interface VercelRequestContextReader {
  get?(): VercelRequestContext | undefined;
}

const REQUEST_CONTEXT_SYMBOL = Symbol.for("@vercel/request-context");

const nitroApp = useNitroApp();

// The Node runtime has no per-request `context` argument, so the request
// context (`waitUntil`, ...) is read from the global symbol the runtime
// populates per request, the same channel `@vercel/functions` uses.
const handler = toNodeHandler((req: ServerRequest) => {
  const context = (globalThis as Record<symbol, VercelRequestContextReader | undefined>)[
    REQUEST_CONTEXT_SYMBOL
  ]?.get?.();

  if (context) {
    req.runtime ??= { name: "vercel" };
    req.runtime.vercel = { context };
    req.waitUntil = context.waitUntil;
  }

  return nitroApp.fetch(req);
});

const ws = import.meta._websocket ? wsAdapter({ resolve: resolveWebsocketHooks }) : undefined;

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

  // Websocket upgrade
  // https://crossws.unjs.io/adapters/vercel
  if (ws && (await ws.handleNodeUpgrade(req as IncomingMessage, res as ServerResponse))) {
    return;
  }

  return handler(req as any, res as any);
}
