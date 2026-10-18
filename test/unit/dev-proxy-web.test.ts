import type { Nitro } from "nitro/types";
import type { Server } from "srvx";
import { serve } from "crossws/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NitroDevApp } from "../../src/dev/app.ts";

function wsMessages(url: string, send: string, count = 2) {
  return new Promise<string[]>((resolve, reject) => {
    const messages: string[] = [];
    const ws = new WebSocket(url);
    const timeout = setTimeout(() => reject(new Error("websocket timed out")), 5000);
    ws.addEventListener("open", () => ws.send(send));
    ws.addEventListener("message", (event) => {
      messages.push(String(event.data));
      if (messages.length === count) {
        clearTimeout(timeout);
        ws.close();
        resolve(messages);
      }
    });
    ws.addEventListener("error", () => reject(new Error("websocket error")));
  });
}

describe("dev server devProxy (runtime-agnostic)", () => {
  let upstream: Server;
  let front: Server;
  let app: NitroDevApp;

  beforeAll(async () => {
    upstream = serve({
      port: 0,
      hostname: "127.0.0.1",
      silent: true,
      fetch: (req) => {
        const url = new URL(req.url);
        return Response.json({ path: url.pathname + url.search, method: req.method });
      },
      websocket: {
        open(peer) {
          peer.send(`open:${new URL(peer.request.url).pathname}`);
        },
        message(peer, message) {
          peer.send(`echo:${message.text()}`);
        },
      },
    });
    await upstream.ready();
    const target = `http://127.0.0.1:${new URL(upstream.url!).port}`;
    app = new NitroDevApp({
      logger: console,
      options: {
        baseURL: "/",
        devHandlers: [],
        publicAssets: [],
        devProxy: {
          "/proxy/ws": { target, ws: true },
          "/proxy/base/**": { target: `${target}/base`, ws: true },
          "/proxy/http/**": { target },
        },
      },
    } as unknown as Nitro);
    front = serve({
      port: 0,
      hostname: "127.0.0.1",
      silent: true,
      fetch: app.fetch,
      websocket: {
        resolve: (req) => app.resolveWebSocketProxy(req) || {},
      },
    });
    await front.ready();
  });

  afterAll(async () => {
    await Promise.all([front?.close(true), upstream?.close(true)]);
  });

  it("proxies HTTP requests without a Node.js request", async () => {
    const res = await app.fetch(new Request("http://localhost/proxy/http/foo?bar=1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ path: "/proxy/http/foo?bar=1", method: "GET" });
  });

  it("prepends the target path", async () => {
    const res = await app.fetch(new Request("http://localhost/proxy/base/foo", { method: "POST" }));
    expect(await res.json()).toEqual({ path: "/base/proxy/base/foo", method: "POST" });
  });

  it("resolves websocket hooks only for rules with `ws` enabled", () => {
    expect(app.resolveWebSocketProxy(new Request("http://localhost/proxy/ws"))).toBeDefined();
    expect(app.resolveWebSocketProxy(new Request("http://localhost/proxy/base/x"))).toBeDefined();
    expect(app.resolveWebSocketProxy(new Request("http://localhost/proxy/http/x"))).toBeUndefined();
    expect(app.resolveWebSocketProxy(new Request("http://localhost/other"))).toBeUndefined();
  });

  it("proxies websocket connections through crossws hooks", async () => {
    const url = front.url!.replace("http", "ws");
    expect(await wsMessages(`${url}proxy/ws`, "ping")).toEqual(["open:/proxy/ws", "echo:ping"]);
    expect(await wsMessages(`${url}proxy/base/x`, "pong")).toEqual([
      "open:/base/proxy/base/x",
      "echo:pong",
    ]);
  });
});
