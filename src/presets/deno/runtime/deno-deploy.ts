import "#nitro-internal-pollyfills";
import type { ServerRequest } from "srvx";
import { useNitroApp } from "nitro/runtime";

import type { Deno as _Deno } from "@deno/types";
import wsAdapter from "crossws/adapters/deno";

const nitroApp = useNitroApp();

const ws = import.meta._websocket
  ? // @ts-expect-error
    wsAdapter(nitroApp.h3App.websocket)
  : undefined;

// TODO: Migrate to srvx to provide request IP
Deno.serve((request: Request, info: _Deno.ServeHandlerInfo) => {
  // https://crossws.unjs.io/adapters/deno
  if (
    import.meta._websocket &&
    request.headers.get("upgrade") === "websocket"
  ) {
    return ws!.handleUpgrade(request, info);
  }

  return nitroApp.fetch(request, undefined, {
    _platform: { deno: { request, info } },
  });
});
