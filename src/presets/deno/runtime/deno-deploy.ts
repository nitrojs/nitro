import "#nitro-internal-pollyfills";
import type { ServerRequest } from "srvx";
import { useNitroApp } from "nitro/runtime";

import type { Deno as _Deno } from "@deno/types";
import wsAdapter from "crossws/adapters/deno";

declare global {
  const Deno: typeof import("@deno/types").Deno;
}

const nitroApp = useNitroApp();

const ws = import.meta._websocket
  ? // @ts-expect-error
    wsAdapter(nitroApp.h3App.websocket)
  : undefined;

// TODO: Migrate to srvx to provide request IP
Deno.serve((denoReq: Request, info: _Deno.ServeHandlerInfo) => {
  // srvx compatibility
  const req = denoReq as unknown as ServerRequest;
  req.runtime ??= { name: "deno" };
  req.runtime.deno ??= { info } as any;
  // TODO: Support remoteAddr

  // https://crossws.unjs.io/adapters/deno
  if (import.meta._websocket && req.headers.get("upgrade") === "websocket") {
    return ws!.handleUpgrade(req, info);
  }

  return nitroApp.fetch(req);
});
