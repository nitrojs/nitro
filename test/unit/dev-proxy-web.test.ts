import { createServer } from "node:net";
import type { Nitro } from "nitro/types";
import type { Server } from "srvx";
import { serve } from "crossws/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NitroDevApp } from "../../src/dev/app.ts";
import { createWorkerWebSocketProxy } from "../../src/dev/_proxy.ts";

const hasIPv6 = await new Promise<boolean>((resolve) => {
  const server = createServer()
    .once("error", () => resolve(false))
    .listen(0, "::1", () => server.close(() => resolve(true)));
});

function createApp(devProxy: Record<string, unknown>) {
  return new NitroDevApp({
    logger: console,
    options: { baseURL: "/", devHandlers: [], publicAssets: [], devProxy },
  } as unknown as Nitro);
}

// Requests without a Node.js request (Bun/Deno native servers) carry the client address on `ip`
function webRequest(url: string, init?: RequestInit & { ip?: string }) {
  return Object.assign(new Request(url, init), { ip: init?.ip });
}

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
    ws.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error(`websocket error (received: ${JSON.stringify(messages)})`));
    });
  });
}

describe("dev server devProxy (runtime-agnostic)", () => {
  let upstream: Server;
  let front: Server;
  let target: string;
  let app: NitroDevApp;

  beforeAll(async () => {
    upstream = serve({
      port: 0,
      hostname: hasIPv6 ? "::" : "127.0.0.1",
      silent: true,
      fetch: (req) => {
        const url = new URL(req.url);
        return Response.json({
          path: url.pathname + url.search,
          method: req.method,
          headers: Object.fromEntries(req.headers),
        });
      },
      websocket: {
        open(peer) {
          const url = new URL(peer.request.url);
          peer.send(`open:${url.pathname}${url.search}`);
        },
        message(peer, message) {
          peer.send(`echo:${message.text()}`);
        },
      },
    });
    await upstream.ready();
    const port = new URL(upstream.url!).port;
    target = `http://127.0.0.1:${port}`;
    app = createApp({
      "/proxy/ws": { target, ws: true },
      "/proxy/base/**": { target: `${target}/base`, ws: true },
      "/proxy/query/**": { target: `${target}/base?token=abc`, ws: true },
      "/proxy/ignore/**": { target: `${target}/base?token=abc`, ignorePath: true },
      "/proxy/auth/**": { target, auth: "user:pässword" },
      "/proxy/ipv6/**": { target: { host: "::1", port } },
      "/proxy/http/**": { target },
    });
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

  async function proxy(path: string, init?: RequestInit & { ip?: string }) {
    const res = await app.fetch(webRequest(`http://localhost${path}`, init));
    expect(res.status).toBe(200);
    return (await res.json()) as { path: string; method: string; headers: Record<string, string> };
  }

  it("proxies HTTP requests without a Node.js request", async () => {
    expect(await proxy("/proxy/http/foo?bar=1")).toMatchObject({
      path: "/proxy/http/foo?bar=1",
      method: "GET",
    });
  });

  it("prepends the target path", async () => {
    expect(await proxy("/proxy/base/foo", { method: "POST" })).toMatchObject({
      path: "/base/proxy/base/foo",
      method: "POST",
    });
  });

  it("merges the target query", async () => {
    expect((await proxy("/proxy/query/x?a=1")).path).toBe("/base/proxy/query/x?token=abc&a=1");
    expect((await proxy("/proxy/query/x")).path).toBe("/base/proxy/query/x?token=abc");
    expect((await proxy("/proxy/ignore/x?a=1")).path).toBe("/base?token=abc");
  });

  it("keeps paths starting with `//`", async () => {
    const res = await createApp({ "/**": { target } }).fetch(
      webRequest("http://localhost//foo/bar?q=1")
    );
    expect(((await res.json()) as { path: string }).path).toBe("//foo/bar?q=1");
  });

  it("forwards the client address", async () => {
    const { headers } = await proxy("/proxy/http/xfwd", { ip: "10.0.0.1" });
    expect(headers).toMatchObject({
      "x-forwarded-for": "10.0.0.1",
      "x-forwarded-port": "80",
      "x-forwarded-proto": "http",
      "x-forwarded-host": "localhost",
    });
  });

  it("sets basic auth (UTF-8) unless the client sent credentials", async () => {
    const encoded = Buffer.from("user:pässword").toString("base64");
    expect((await proxy("/proxy/auth/x")).headers.authorization).toBe(`Basic ${encoded}`);
    const { headers } = await proxy("/proxy/auth/x", { headers: { authorization: "Bearer t" } });
    expect(headers.authorization).toBe("Bearer t");
  });

  it.skipIf(!hasIPv6)("proxies to IPv6 object targets", async () => {
    expect((await proxy("/proxy/ipv6/x")).path).toBe("/proxy/ipv6/x");
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
    expect(await wsMessages(`${url}proxy/query/x?a=1`, "q")).toEqual([
      "open:/base/proxy/query/x?token=abc&a=1",
      "echo:q",
    ]);
  });
});

describe("dev server worker websocket proxy", () => {
  let upstream: Server;
  const fronts: Server[] = [];

  beforeAll(async () => {
    upstream = serve({
      port: 0,
      hostname: "127.0.0.1",
      silent: true,
      fetch: () => new Response("upstream"),
      websocket: {
        open(peer) {
          peer.send(`open:${peer.request.headers.get("x-forwarded-for")}`);
        },
        message(peer, message) {
          peer.send(`echo:${message.text()}`);
        },
      },
    });
    await upstream.ready();
  });

  afterAll(async () => {
    await Promise.all([upstream?.close(true), ...fronts.map((s) => s.close(true))]);
  });

  async function listen(resolveHooks: ReturnType<typeof createWorkerWebSocketProxy>) {
    const server = serve({
      port: 0,
      hostname: "127.0.0.1",
      silent: true,
      fetch: () => new Response("front"),
      websocket: { resolve: () => resolveHooks() },
    });
    fronts.push(server);
    await server.ready();
    return server.url!.replace("http", "ws");
  }

  it("proxies to the worker address", async () => {
    const port = Number(new URL(upstream.url!).port);
    const url = await listen(createWorkerWebSocketProxy(() => ({ host: "127.0.0.1", port })));
    expect(await wsMessages(`${url}ws`, "hi")).toEqual(["open:127.0.0.1", "echo:hi"]);
  });

  it("rejects the handshake when the worker has no usable address", async () => {
    const url = await listen(createWorkerWebSocketProxy(() => ({ host: "127.0.0.1", port: 0 })));
    await expect(wsMessages(`${url}ws`, "hi")).rejects.toThrow("websocket error (received: [])");
  });
});
