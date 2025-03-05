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
  return handleRequest(request, info);
});

async function handleRequest(request: Request, info: _Deno.ServeHandlerInfo) {
  const url = new URL(request.url);

  const headers = new Headers(request.headers);

  // Add client IP address to headers
  // (rightmost is most trustable)
  headers.append("x-forwarded-for", info.remoteAddr.hostname);

  // There is currently no way to know if the request was made over HTTP or HTTPS
  // Deno deploy force redirects to HTTPS so we assume HTTPS by default
  if (!headers.has("x-forwarded-proto")) {
    headers.set("x-forwarded-proto", "https");
  }

  // https://deno.land/api?s=Body
  let body;
  if (request.body) {
    body = await request.arrayBuffer();
  }

  return nitroApp.localFetch(url.pathname + url.search, {
    host: url.hostname,
    protocol: url.protocol,
    headers,
    method: request.method,
    redirect: request.redirect,
    body,
  });
}
