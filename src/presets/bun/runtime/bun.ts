import "#nitro-internal-pollyfills";
import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import { useNitroApp } from "nitropack/runtime";
import { startScheduleRunner } from "nitropack/runtime/internal";

import wsAdapter from "crossws/adapters/bun";

const nitroApp = useNitroApp();

// `localFetch` attaches the pre-read body as a plain property of unenv's
// `IncomingMessage` mock, which is not a readable stream. Expose it through a
// real `node:stream` Readable so that raw pass-through such as
// `fetch(url, { body: event.node.req })` works like it does with `node-server`.
// https://github.com/nitrojs/nitro/issues/4604
nitroApp.hooks.hook("request", (event) => {
  const req = event.node.req as IncomingMessage & { body?: unknown };
  if (!("__unenv__" in req)) {
    return;
  }
  const body = toBuffer(req.body);
  if (body) {
    event.node.req = toReadableRequest(req, body);
  }
});

const ws = import.meta._websocket
  ? wsAdapter(nitroApp.h3App.websocket)
  : undefined;

// @ts-expect-error
const server = Bun.serve({
  port: process.env.NITRO_PORT || process.env.PORT || 3000,
  host: process.env.NITRO_HOST || process.env.HOST,
  idleTimeout:
    Number.parseInt(process.env.NITRO_BUN_IDLE_TIMEOUT as string) || undefined,
  websocket: import.meta._websocket ? ws!.websocket : (undefined as any),
  async fetch(req: Request, server: any) {
    // https://crossws.unjs.io/adapters/bun
    if (import.meta._websocket && req.headers.get("upgrade") === "websocket") {
      return ws!.handleUpgrade(req, server);
    }

    const url = new URL(req.url);

    let body;
    if (req.body) {
      body = await req.arrayBuffer();
    }

    return nitroApp.localFetch(url.pathname + url.search, {
      host: url.hostname,
      protocol: url.protocol,
      headers: req.headers,
      method: req.method,
      redirect: req.redirect,
      body,
    });
  },
});

console.log(`Listening on ${server.url}...`);

// Scheduled tasks
if (import.meta._tasks) {
  startScheduleRunner();
}

function toBuffer(body: unknown): Buffer | undefined {
  if (typeof body === "string") {
    return Buffer.from(body);
  }
  if (body instanceof ArrayBuffer) {
    return Buffer.from(body);
  }
  if (ArrayBuffer.isView(body)) {
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  }
}

// Request properties carried over from the mock to the readable request
const requestKeys = [
  "httpVersion",
  "httpVersionMajor",
  "httpVersionMinor",
  "complete",
  "aborted",
  "method",
  "url",
  "headers",
  "trailers",
  "socket",
  "connection",
  "body", // keeps h3 `readRawBody` fast path working
  "__unenv__", // platform context
] as const;

function toReadableRequest(
  req: IncomingMessage,
  body: Buffer
): IncomingMessage {
  const readable = new Readable({
    read() {
      this.push(body);
      this.push(null);
    },
  });
  for (const key of requestKeys) {
    (readable as any)[key] = (req as any)[key];
  }
  Object.defineProperty(readable, "rawHeaders", {
    get: () => req.rawHeaders,
  });
  return readable as unknown as IncomingMessage;
}
