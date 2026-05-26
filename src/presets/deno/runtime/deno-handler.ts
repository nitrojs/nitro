import "#nitro-internal-pollyfills";
import "./_deno-env-polyfill";
import { useNitroApp } from "nitropack/runtime";

import type { Deno as _Deno } from "@deno/types";
import wsAdapter from "crossws/adapters/deno";

// TODO: Declare conflict with crossws
declare global {
  const Deno: typeof import("@deno/types").Deno;
}

const nitroApp = useNitroApp();

// Websocket support
const ws = import.meta._websocket
  ? wsAdapter(nitroApp.h3App.websocket)
  : undefined;

export async function fetch(
  request: Request,
  info?: _Deno.ServeHandlerInfo
): Promise<Response> {
  // https://crossws.unjs.io/adapters/deno
  if (
    import.meta._websocket &&
    request.headers.get("upgrade") === "websocket"
  ) {
    if (!info) {
      throw new Error(
        "deno-handler: websocket upgrade requires the second `info` arg from Deno.serve"
      );
    }
    return ws!.handleUpgrade(request, info);
  }

  const url = new URL(request.url);

  // https://deno.land/api?s=Body
  let body;
  if (request.body) {
    body = await request.arrayBuffer();
  }

  return nitroApp.localFetch(url.pathname + url.search, {
    host: url.hostname,
    protocol: url.protocol,
    headers: request.headers,
    method: request.method,
    redirect: request.redirect,
    body,
  });
}

// Library mode: caller invokes `fetch(request, info?)` directly. No port is
// bound; the embedding process owns the listen lifecycle (e.g. a multi-site
// dispatcher routing several Nitro builds in the same Deno runtime).
export default { fetch };
