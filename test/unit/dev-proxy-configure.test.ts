import type { DevProxyOptions, Nitro, NitroOptions } from "nitro/types";
import type { Server } from "srvx";
import { serve } from "srvx/node";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NitroDevApp } from "../../src/dev/app.ts";

describe("dev server devProxy configure", () => {
  let upstream: Server;
  let target: string;
  const fronts: Server[] = [];

  beforeAll(async () => {
    upstream = serve({
      port: 0,
      hostname: "127.0.0.1",
      silent: true,
      fetch: (req) => {
        const url = new URL(req.url);
        return Response.json({
          path: url.pathname + url.search,
          headers: Object.fromEntries(req.headers),
        });
      },
    });
    await upstream.ready();
    target = upstream.url!;
  });

  afterAll(async () => {
    await Promise.all([upstream?.close(true), ...fronts.map((server) => server.close(true))]);
  });

  it("configures once before traffic and changes Node request and response headers", async () => {
    const configure = vi.fn<NonNullable<DevProxyOptions["configure"]>>((proxy) => {
      proxy.on("proxyReq", (req) => req.setHeader("x-configured-request", "request"));
      proxy.on("proxyRes", (res) => {
        res.headers["x-configured-response"] = "response";
      });
    });
    const options: DevProxyOptions = { target, changeOrigin: true, configure };
    const url = await listen({ "/proxy/**": options });
    expect(configure).toHaveBeenCalledOnce();
    expect(configure.mock.calls[0]![1]).toBe(options);
    expect(configure.mock.calls[0]![0].options).toMatchObject({ target, changeOrigin: true });

    for (const path of ["/proxy/first", "/proxy/second?foo=1"]) {
      const response = await fetch(new URL(path, url));
      expect(response.status).toBe(200);
      expect(response.headers.get("x-configured-response")).toBe("response");
      expect(await response.json()).toMatchObject({
        path,
        headers: { "x-configured-request": "request" },
      });
    }
    expect(configure).toHaveBeenCalledOnce();
  });

  it.each(["string", "object"])("preserves %s rules without configure", async (format) => {
    const url = await listen({ "/proxy/**": format === "string" ? target : { target } });
    const path = "/proxy/default?foo=1";
    const response = await fetch(new URL(path, url));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      path,
      headers: { "x-forwarded-proto": "http", "x-forwarded-for": "127.0.0.1" },
    });
  });

  async function listen(devProxy: NitroOptions["devProxy"]) {
    const app = new NitroDevApp({
      logger: console,
      options: { baseURL: "/", devHandlers: [], publicAssets: [], devProxy },
    } as unknown as Nitro);
    const server = serve({ port: 0, hostname: "127.0.0.1", silent: true, fetch: app.fetch });
    fronts.push(server);
    await server.ready();
    return server.url!;
  }
});
