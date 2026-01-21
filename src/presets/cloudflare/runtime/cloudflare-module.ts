import "#nitro/virtual/polyfills";
import type { fetch } from "@cloudflare/workers-types";
import wsAdapter from "crossws/adapters/cloudflare";

import { isPublicAssetURL } from "#nitro/virtual/public-assets";
import { createHandler } from "./_module-handler.ts";
import { resolveWebsocketHooks } from "#nitro/runtime/app";

const ws = import.meta._websocket
  ? wsAdapter({ resolve: resolveWebsocketHooks })
  : undefined;

interface Env {
  ASSETS?: { fetch: typeof fetch };
}

export default createHandler<Env>({
  fetch(cfRequest, env, context, url) {
    // Static assets fallback (optional binding)
    if (env.ASSETS && isPublicAssetURL(url.pathname)) {
      return env.ASSETS.fetch(cfRequest as any);
    }

    // Websocket upgrade
    // https://crossws.unjs.io/adapters/cloudflare
    if (
      import.meta._websocket &&
      cfRequest.headers.get("upgrade") === "websocket"
    ) {
      return ws!.handleUpgrade(cfRequest, env, context);
    }
  },
});
