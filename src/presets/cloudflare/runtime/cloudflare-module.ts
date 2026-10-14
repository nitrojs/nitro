import "#nitro/virtual/polyfills";
import type { fetch } from "@cloudflare/workers-types";
import wsAdapter from "crossws/adapters/cloudflare";

import { isPublicAssetURL } from "#nitro/virtual/public-assets";
import { createHandler } from "./_module-handler.ts";
import { resolveWebsocketHooks } from "#nitro/runtime/app";

const ws = import.meta._websocket ? wsAdapter({ resolve: resolveWebsocketHooks }) : undefined;

interface Env {
  ASSETS?: { fetch: typeof fetch };
}

export default createHandler<Env>({
  async fetch(cfRequest, env, context, url) {
    // Static assets fallback (optional binding)
    if (env.ASSETS && isPublicAssetURL(url.pathname)) {
      const res = await env.ASSETS.fetch(cfRequest as any);
      // The `_headers` rule of a public assets base also applies to a missing
      // file. Do not let browsers cache that 404 for the lifetime of the assets.
      if (
        res.status === 404 &&
        /max-age=[1-9]|immutable/i.test(res.headers.get("cache-control") || "")
      ) {
        const notFound = new Response(res.body as any, res as any);
        notFound.headers.set("cache-control", "no-store");
        return notFound as any;
      }
      return res;
    }

    // Websocket upgrade
    // https://crossws.unjs.io/adapters/cloudflare
    if (import.meta._websocket && cfRequest.headers.get("upgrade") === "websocket") {
      return ws!.handleUpgrade(cfRequest, env, context);
    }
  },
});
