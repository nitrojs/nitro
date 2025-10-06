import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";
import { useRuntimeConfig } from "nitro/runtime";
import { startScheduleRunner } from "nitro/runtime/internal";

import type { Deno as _Deno } from "@deno/types";
import wsAdapter from "crossws/adapters/deno";
import destr from "destr";
import type { ServerRequest } from "srvx";

// TODO: Declare conflict with crossws
declare global {
  const Deno: typeof import("@deno/types").Deno;
}

const nitroApp = useNitroApp();

if (Deno.env.get("DEBUG")) {
  addEventListener("unhandledrejection", (event: any) =>
    console.error("[unhandledRejection]", event.reason)
  );
  addEventListener("error", (event: any) =>
    console.error("[uncaughtException]", event.error)
  );
} else {
  addEventListener("unhandledrejection", (err: any) =>
    console.error("[unhandledRejection] " + err)
  );
  addEventListener("error", (event: any) =>
    console.error("[uncaughtException] " + event.error)
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

// WebSocket support
const ws = import.meta._websocket
  ? // @ts-expect-error
    wsAdapter(nitroApp.h3App.websocket)
  : undefined;

async function handler(denoReq: Request, info: any) {
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
}

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner();
}

export default {};
