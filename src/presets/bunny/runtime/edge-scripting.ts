import "#nitro/virtual/polyfills";
import type { ServerRequest } from "srvx";
import { serve } from "srvx/bunny";
import wsAdapter from "crossws/adapters/bunny";

import { useNitroApp } from "nitro/app";
import { resolveWebsocketHooks } from "#nitro/runtime/app";
import { tracingSrvxPlugins } from "#nitro/virtual/tracing";

const nitroApp = useNitroApp();

let _fetch = nitroApp.fetch;

if (import.meta._websocket) {
  const { handleUpgrade } = wsAdapter({ resolve: resolveWebsocketHooks });
  _fetch = (req: ServerRequest) => {
    if (req.headers.get("upgrade") === "websocket") {
      return handleUpgrade(req);
    }
    return nitroApp.fetch(req);
  };
}

serve({
  fetch: _fetch,
  plugins: [...tracingSrvxPlugins],
});

export default {};
