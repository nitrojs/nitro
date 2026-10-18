import "#nitro/virtual/polyfills";
import wsAdapter from "crossws/adapters/vercel";
import { useNitroApp, getRouteRules } from "nitro/app";
import { resolveWebsocketHooks } from "#nitro/runtime/app";

import type { ServerRequest } from "srvx";
import { isrRouteRewrite } from "./isr.ts";

const nitroApp = useNitroApp();

const ws = import.meta._websocket ? wsAdapter({ resolve: resolveWebsocketHooks }) : undefined;

export default {
  async fetch(req: ServerRequest, context: { waitUntil: (promise: Promise<any>) => void }) {
    // Websocket upgrade
    // https://crossws.unjs.io/adapters/vercel
    if (ws && req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const response = await ws.handleWebUpgrade(req);
      if (response) {
        return response;
      }
    }

    // ISR route rewrite
    const isrURL = isrRouteRewrite(req.url, req.headers.get("x-now-route-matches"));
    if (isrURL) {
      const { routeRules } = getRouteRules("", isrURL[0]);
      if (routeRules?.isr) {
        req = new Request(
          new URL(isrURL[0] + (isrURL[1] ? `?${isrURL[1]}` : ""), req.url).href,
          req
        );
      }
    }

    req.runtime ??= { name: "vercel" };
    req.runtime.vercel = { context };

    let ip: string | undefined;
    Object.defineProperty(req, "ip", {
      get() {
        const h = req.headers.get("x-forwarded-for");
        return (ip ??= h?.split(",").shift()?.trim());
      },
    });

    req.waitUntil = context?.waitUntil;

    return nitroApp.fetch(req);
  },
};
