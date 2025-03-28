import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";

import type { Deno as _Deno } from "@deno/types";
import wsAdapter from "crossws/adapters/deno";

const nitroApp = useNitroApp();

const ws = import.meta._websocket
  ? wsAdapter(nitroApp.h3App.websocket)
  : undefined;

Deno.serve((request: Request, info: _Deno.ServeHandlerInfo) => {
  // https://crossws.unjs.io/adapters/deno
  if (
    import.meta._websocket &&
    request.headers.get("upgrade") === "websocket"
  ) {
    return ws!.handleUpgrade(request, info);
  }

  // Add client IP address to headers
  // (rightmost is most trustable)
  request.headers.append("x-forwarded-for", info.remoteAddr.hostname);

  // There is currently no way to know if the request was made over HTTP or HTTPS
  // Deno deploy force redirects to HTTPS so we assume HTTPS by default
  if (!request.headers.has("x-forwarded-proto")) {
    request.headers.set("x-forwarded-proto", "https");
  }

  return nitroApp.fetch(request, {
    h3: { _platform: { deno: { request, info } } },
  });
});
