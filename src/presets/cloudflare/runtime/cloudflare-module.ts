import "#nitro/virtual/polyfills";
import type { fetch } from "@cloudflare/workers-types";
import wsAdapter from "crossws/adapters/cloudflare";

import { isPublicAssetURL } from "#nitro/virtual/public-assets";
import { createHandler } from "./_module-handler.ts";
import { resolveWebsocketHooks } from "#nitro/runtime/app";
import { hasWebSocket } from "#nitro/virtual/feature-flags";

const ws = hasWebSocket
  ? wsAdapter({ resolve: resolveWebsocketHooks })
  : undefined;

interface Env {
  ASSETS?: { fetch: typeof fetch };
}

export default createHandler<Env>({
  fetch(request, env, context, url) {
    // Static assets fallback (optional binding)
    if (env.ASSETS && isPublicAssetURL(url.pathname)) {
      return env.ASSETS.fetch(request);
    }

    // Websocket upgrade
    // https://crossws.unjs.io/adapters/cloudflare
    if (hasWebSocket && request.headers.get("upgrade") === "websocket") {
      // Ensure Cloudflare bindings are available on `peer.context` inside WebSocket handlers.
      // crossws will forward `request.context` to `peer.context`.
      let wsContext = (request as any).context;
      if (!wsContext) {
        wsContext = {};
        Object.defineProperty(request as any, "context", {
          enumerable: true,
          value: wsContext,
        });
      }
      wsContext.cloudflare ||= {};
      wsContext.cloudflare.env ||= env;
      wsContext.cloudflare.context ||= context;
      return ws!.handleUpgrade(request as any, env, context);
    }
  },
});
