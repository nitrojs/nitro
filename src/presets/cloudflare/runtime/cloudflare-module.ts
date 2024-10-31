import "#nitro-internal-pollyfills";
import type { fetch } from "@cloudflare/workers-types";
import wsAdapter from "crossws/adapters/cloudflare";
import { useNitroApp } from "nitropack/runtime";
import { isPublicAssetURL } from "#nitro-internal-virtual/public-assets";
import { createHandler } from "./_module-handler";

const nitroApp = useNitroApp();

const ws = import.meta._websocket
  ? wsAdapter(nitroApp.h3App.websocket)
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
    if (
      import.meta._websocket &&
      request.headers.get("upgrade") === "websocket"
    ) {
      return ws!.handleUpgrade(request as any, env, context);
    }
  },
});
