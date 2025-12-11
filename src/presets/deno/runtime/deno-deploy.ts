import "#nitro-internal-polyfills";
import type { ServerRequest } from "srvx";
import type { Deno as _Deno } from "@deno/types";
import wsAdapter from "crossws/adapters/deno";

import { useNitroApp } from "nitro/app";
import { resolveWebsocketHooks } from "#runtime/app";
import { hasWebSocket } from "#nitro-internal-virtual/feature-flags";

declare global {
  var Deno: typeof _Deno;
}

const nitroApp = useNitroApp();

const ws = hasWebSocket
  ? wsAdapter({ resolve: resolveWebsocketHooks })
  : undefined;

// TODO: Migrate to srvx to provide request IP
Deno.serve((denoReq: Request, info: _Deno.ServeHandlerInfo) => {
  // srvx compatibility
  const req = denoReq as unknown as ServerRequest;
  req.runtime ??= { name: "deno" };
  req.runtime.deno ??= { info } as any;
  // TODO: Support remoteAddr

  // https://crossws.unjs.io/adapters/deno
  if (hasWebSocket && req.headers.get("upgrade") === "websocket") {
    return ws!.handleUpgrade(req, info);
  }

  return nitroApp.fetch(req);
});
