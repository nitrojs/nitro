import "#nitro-internal-pollyfills";
import "./_deno-env-polyfill";
import { useNitroApp } from "nitropack/runtime";
import { useRuntimeConfig } from "nitropack/runtime";
import { startScheduleRunner } from "nitropack/runtime/internal";

import type { Deno as _Deno } from "@deno/types";
import wsAdapter from "crossws/adapters/deno";
import destr from "destr";

// TODO: Declare conflict with crossws
declare global {
  const Deno: typeof import("@deno/types").Deno;
}

const nitroApp = useNitroApp();

if (Deno.env.get("DEBUG")) {
  addEventListener("unhandledrejection", (event: any) =>
    console.error("[nitro] [dev] [unhandledRejection]", event.reason)
  );
  addEventListener("error", (event: any) =>
    console.error("[nitro] [dev] [uncaughtException]", event.error)
  );
} else {
  addEventListener("unhandledrejection", (err: any) =>
    console.error("[nitro] [production] [unhandledRejection] " + err)
  );
  addEventListener("error", (event: any) =>
    console.error("[nitro] [production] [uncaughtException] " + event.error)
  );
}

// https://deno.land/api@v1.42.4?s=Deno.serve
const serveOptions: _Deno.ServeOptions & Partial<_Deno.ServeTlsOptions> = {
  key: Deno.env.get("NITRO_SSL_KEY"),
  cert: Deno.env.get("NITRO_SSL_CERT"),
  port: destr(Deno.env.get("NITRO_PORT") || Deno.env.get("PORT")) || 3000,
  hostname: Deno.env.get("NITRO_HOST") || Deno.env.get("HOST"),
  onListen: (opts) => {
    const baseURL = (useRuntimeConfig().app.baseURL || "").replace(/\/$/, "");
    const url = `${opts.hostname}:${opts.port}${baseURL}`;
    console.log(`Listening ${url}`);
  },
};

// https://github.com/nitrojs/nitro/pull/2373
if (!serveOptions.key || !serveOptions.cert) {
  delete serveOptions.key;
  delete serveOptions.cert;
}

Deno.serve(serveOptions, handler);

// Websocket support
const ws = import.meta._websocket
  ? wsAdapter(nitroApp.h3App.websocket)
  : undefined;

async function handler(request: Request, info: any) {
  // https://crossws.unjs.io/adapters/deno
  if (
    import.meta._websocket &&
    request.headers.get("upgrade") === "websocket"
  ) {
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

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner();
}

export default {};
