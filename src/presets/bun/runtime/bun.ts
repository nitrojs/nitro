import "#nitro/virtual/polyfills";

// React 19's server.edge.js uses ReadableStream({ type: "direct", ... }), a
// Cloudflare Workers extension. Bun follows the web spec strictly and throws
// ERR_INVALID_ARG_VALUE for unknown `type` values. Strip it before it reaches
// Bun's constructor so prerendering works without switching to the node preset.
// Using class extends preserves the prototype chain so instanceof checks work correctly.
const _OriginalReadableStream = globalThis.ReadableStream;
class _PatchedReadableStream extends _OriginalReadableStream {
  constructor(
    underlyingSource?: UnderlyingDefaultSource | UnderlyingByteSource,
    strategy?: QueuingStrategy,
  ) {
    if (
      underlyingSource &&
      (underlyingSource as Record<string, unknown>).type === "direct"
    ) {
      const { type: _type, ...rest } =
        underlyingSource as Record<string, unknown>;
      super(rest as UnderlyingDefaultSource, strategy);
    } else {
      super(underlyingSource as UnderlyingDefaultSource, strategy);
    }
  }
}

// @ts-expect-error -- intentional global override for compat
globalThis.ReadableStream = _PatchedReadableStream;

import type { ServerRequest } from "srvx";
import { serve } from "srvx/bun";
import wsAdapter from "crossws/adapters/bun";

import { useNitroApp } from "nitro/app";
import { startScheduleRunner } from "#nitro/runtime/task";
import { trapUnhandledErrors } from "#nitro/runtime/error/hooks";
import { resolveWebsocketHooks } from "#nitro/runtime/app";
import { tracingSrvxPlugins } from "#nitro/virtual/tracing";
const _parsedPort = Number.parseInt(process.env.NITRO_PORT ?? process.env.PORT ?? "");
const port = Number.isNaN(_parsedPort) ? 3000 : _parsedPort;
const host = process.env.NITRO_HOST || process.env.HOST;
const cert = process.env.NITRO_SSL_CERT;
const key = process.env.NITRO_SSL_KEY;
// const socketPath = process.env.NITRO_UNIX_SOCKET; // TODO

const nitroApp = useNitroApp();

let _fetch = nitroApp.fetch;

const ws = import.meta._websocket ? wsAdapter({ resolve: resolveWebsocketHooks }) : undefined;

if (import.meta._websocket) {
  _fetch = (req: ServerRequest) => {
    if (req.headers.get("upgrade") === "websocket") {
      return ws!.handleUpgrade(req, req.runtime!.bun!.server) as Promise<Response>;
    }
    return nitroApp.fetch(req);
  };
}

const server = serve({
  port,
  hostname: host,
  tls: cert && key ? { cert, key } : undefined,
  fetch: _fetch,
  bun: {
    websocket: import.meta._websocket ? ws?.websocket : undefined,
  },
  plugins: [...tracingSrvxPlugins],
});

trapUnhandledErrors();

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner({ waitUntil: server.waitUntil });
}

export default {};
