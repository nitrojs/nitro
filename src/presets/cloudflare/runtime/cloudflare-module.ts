import "#nitro/virtual/polyfills";
import type { fetch } from "@cloudflare/workers-types";

import { isPublicAssetURL } from "#nitro/virtual/public-assets";
import { createHandler, fetchPublicAsset } from "./_module-handler.ts";
import { ws } from "./_durable.ts";

export { $DurableObject } from "./_durable.ts";

interface Env {
  ASSETS?: { fetch: typeof fetch };
}

export default createHandler<Env>({
  async fetch(cfRequest, env, context, url) {
    // Static assets fallback (optional binding)
    if (env.ASSETS && isPublicAssetURL(url.pathname)) {
      return fetchPublicAsset(env.ASSETS, cfRequest) as any;
    }

    // Websocket upgrade
    // https://crossws.h3.dev/adapters/cloudflare
    if (import.meta._websocket && cfRequest.headers.get("upgrade") === "websocket") {
      return ws!.handleUpgrade(cfRequest, env, context);
    }
  },
});
