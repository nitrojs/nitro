import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { serve, type ServerHandler } from "srvx";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Nitro } from "nitro/types";
import { NitroDevApp } from "../../src/dev/app.ts";

describe("dev proxy", () => {
  let target: Server;
  let devServer: ReturnType<typeof serve>;
  let devURL: string;

  beforeAll(async () => {
    target = createServer((req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ url: req.url }));
    });
    await new Promise<void>((resolve) => target.listen(0, "127.0.0.1", () => resolve()));
    const targetPort = (target.address() as AddressInfo).port;

    const nitro = {
      options: {
        baseURL: "/",
        devHandlers: [],
        publicAssets: [],
        devProxy: {
          "/proxy": { target: `http://127.0.0.1:${targetPort}` },
          "/wildcard/**": { target: `http://127.0.0.1:${targetPort}` },
          "/slash/": { target: `http://127.0.0.1:${targetPort}` },
        },
      },
      logger: console,
      vfs: {},
    } as unknown as Nitro;

    const devApp = new NitroDevApp(nitro, () => "app");
    devServer = serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: devApp.fetch as ServerHandler,
    });
    await devServer.ready();
    devURL = devServer.url!;
  });

  afterAll(async () => {
    await devServer?.close(true);
    await new Promise<void>((resolve) => target.close(() => resolve()));
  });

  const req = async (path: string) => {
    const res = await fetch(new URL(path, devURL));
    return { status: res.status, body: await res.text() };
  };

  it("should proxy the exact route", async () => {
    expect(await req("/proxy")).toMatchObject({ status: 200, body: '{"url":"/"}' });
  });

  it("should proxy the trailing slash form", async () => {
    expect(await req("/proxy/")).toMatchObject({ status: 200, body: '{"url":"/"}' });
  });

  it("should proxy nested subpaths with a query string", async () => {
    expect(await req("/proxy/foo/bar?x=1")).toMatchObject({
      status: 200,
      body: '{"url":"/foo/bar?x=1"}',
    });
  });

  it("should not proxy sibling routes with the same prefix", async () => {
    expect(await req("/proxyable")).toMatchObject({ status: 200, body: "app" });
  });

  it("should treat a wildcard rule the same as a bare prefix", async () => {
    expect(await req("/wildcard")).toMatchObject({ status: 200, body: '{"url":"/"}' });
    expect(await req("/wildcard/foo?x=1")).toMatchObject({
      status: 200,
      body: '{"url":"/foo?x=1"}',
    });
  });

  it("should treat a trailing slash rule the same as a bare prefix", async () => {
    expect(await req("/slash")).toMatchObject({ status: 200, body: '{"url":"/"}' });
    expect(await req("/slash/foo?x=1")).toMatchObject({
      status: 200,
      body: '{"url":"/foo?x=1"}',
    });
  });
});
