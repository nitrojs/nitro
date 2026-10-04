import "#nitro/virtual/polyfills";
import type { ServerRequest } from "srvx";
import type { Deno as _Deno } from "@deno/types";
import wsAdapter from "crossws/adapters/deno";

import { useNitroApp } from "nitro/app";
import { resolveWebsocketHooks } from "#nitro/runtime/app";

declare global {
  var Deno: typeof _Deno;
}

const nitroApp = useNitroApp();

const ws = import.meta._websocket ? wsAdapter({ resolve: resolveWebsocketHooks }) : undefined;

Deno.serve((denoReq: Request, info: _Deno.ServeHandlerInfo) => {
  const req = denoReq as unknown as ServerRequest;
  req.runtime ??= { name: "deno" };
  req.runtime.deno ??= { info } as any;
  req.ip =
    denoReq.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    info?.remoteAddr?.hostname;

  // https://crossws.unjs.io/adapters/deno
  if (import.meta._websocket && req.headers.get("upgrade") === "websocket") {
    return ws!.handleUpgrade(req, info);
  }

  return nitroApp.fetch(req);
});
