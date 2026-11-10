import { describe, expect, it } from "vitest";
import type { Nitro, NitroEventHandler } from "nitro/types";

import { initNitroRouting, Router } from "../../src/routing.ts";

type Match = { data: unknown; params?: Record<string, string> } | undefined;

function compile(baseURL: string, routes: { route: string; data: unknown }[]) {
  const router = new Router<unknown>(baseURL);
  router._update(
    routes.map((r) => ({ ...r, method: "" })),
    { merge: true }
  );
  const code = router.compileToString({ serialize: (data) => JSON.stringify(data) });
  return new Function(`return ${code}`)() as (method: string, path: string) => Match;
}

describe("Router.compileToString", () => {
  it("resolves a single catch-all route relative to baseURL", () => {
    const findRoute = compile("/foo/", [{ route: "/**", data: "catchall" }]);

    expect(findRoute("GET", "/")).toBeUndefined();
    expect(findRoute("GET", "/foobar")).toBeUndefined();
    expect(findRoute("GET", "/foo")).toMatchObject({ params: {} });
    expect(findRoute("GET", "/foo/")).toMatchObject({ params: {} });
    expect(findRoute("GET", "/foo/bar/baz")).toMatchObject({ params: { 0: "bar/baz" } });
  });

  it.each(["", "/foo/"])("matches rou3 for a catch-all route (baseURL: %j)", (baseURL) => {
    const fastPath = compile(baseURL, [{ route: "/**", data: "catchall" }]);
    const rou3 = compile(baseURL, [
      { route: "/**", data: "catchall" },
      { route: "/other", data: "other" },
    ]);

    for (const path of ["/", "/foo", "/foo/", "/foo/bar", "/foo/bar/", "/foo/bar/baz", "/foobar"]) {
      expect(fastPath("GET", path), path).toEqual(rou3("GET", path));
    }
  });

  it("merges multiple catch-all handlers with a baseURL", () => {
    const findRoute = compile("/foo/", [
      { route: "/**", data: "a" },
      { route: "/**", data: "b" },
      { route: "/other", data: "other" },
    ]);

    expect(findRoute("GET", "/foo/bar")?.data).toEqual(["a", "b"]);
  });
});

describe("Router headFromGet", () => {
  type R = { route: string; method: string; data: string; head?: boolean };

  function createRouter(routes: R[]) {
    const router = new Router<string>("");
    router._update(routes, { headFromGet: true });
    const code = router.compileToString({ serialize: (data) => JSON.stringify(data) });
    const compiled = new Function(`return ${code}`)() as (method: string, path: string) => Match;
    return { router, compiled };
  }

  function expectHeadMatch(routes: R[], path: string, expected: string | undefined) {
    const { router, compiled } = createRouter(routes);
    expect(router.match("HEAD", path), path).toBe(expected);
    expect(compiled("HEAD", path)?.data, path).toBe(expected);
  }

  it("matches `HEAD` requests with `GET` routes", () => {
    expectHeadMatch([{ route: "/a", method: "GET", data: "get" }], "/a", "get");
    expectHeadMatch([{ route: "/a/:id", method: "get", data: "get" }], "/a/1", "get");
  });

  it("prefers a `GET` route over a method-agnostic catch-all", () => {
    const routes = [
      { route: "/**", method: "", data: "catchall" },
      { route: "/a", method: "GET", data: "get" },
    ];
    expectHeadMatch(routes, "/a", "get");
    expectHeadMatch(routes, "/b", "catchall");
  });

  it("prefers a `HEAD` route with the same pattern", () => {
    const routes = [
      { route: "/a", method: "GET", data: "get" },
      { route: "/a", method: "HEAD", data: "head" },
    ];
    expectHeadMatch(routes, "/a", "head");
    expectHeadMatch([...routes].reverse(), "/a", "head");
  });

  it("prefers the most specific route", () => {
    const routes = [
      { route: "/a/**", method: "HEAD", data: "head" },
      { route: "/a/:id", method: "GET", data: "get" },
    ];
    expectHeadMatch(routes, "/a/1", "get");
    expectHeadMatch(routes, "/a/1/2", "head");
  });

  it("does not match `HEAD` requests with `head: false` routes", () => {
    expectHeadMatch([{ route: "/a", method: "GET", data: "get", head: false }], "/a", undefined);
    expectHeadMatch(
      [
        { route: "/**", method: "", data: "catchall" },
        { route: "/a", method: "GET", data: "get", head: false },
      ],
      "/a",
      "catchall"
    );
  });

  it("follows the first `GET` route of a pattern", () => {
    expectHeadMatch(
      [
        { route: "/a", method: "GET", data: "first", head: false },
        { route: "/a", method: "GET", data: "second" },
      ],
      "/a",
      undefined
    );
    expectHeadMatch(
      [
        { route: "/a", method: "GET", data: "first" },
        { route: "/a", method: "GET", data: "second", head: false },
      ],
      "/a",
      "first"
    );
  });

  it("keeps the registered routes as is", () => {
    const routes = [{ route: "/a", method: "GET", data: "get" }];
    expect(createRouter(routes).router.routes).toEqual(routes);
  });

  it("does not add `HEAD` copies without the option", () => {
    const router = new Router<string>("");
    router._update([{ route: "/a", method: "GET", data: "get" }]);
    expect(router.match("HEAD", "/a")).toBeUndefined();
  });
});

describe("initNitroRouting", () => {
  function createNitro(handlers: NitroEventHandler[]) {
    const nitro = {
      options: {
        dev: false,
        preset: "node-server",
        baseURL: "/",
        routeRules: {},
        routes: {},
        handlers,
        serveStatic: false,
        publicAssets: [],
      },
      scannedHandlers: [],
    } as unknown as Nitro;
    initNitroRouting(nitro);
    nitro.routing.sync();
    return nitro;
  }

  it("matches `HEAD` requests with `GET` routes unless `head: false`", () => {
    const nitro = createNitro([
      { route: "/a", method: "GET", handler: "./a.ts" },
      { route: "/b", method: "GET", handler: "./b.ts", head: false },
    ]);
    expect(nitro.routing.routes.match("HEAD", "/a")).toMatchObject({ handler: "./a.ts" });
    expect(nitro.routing.routes.match("HEAD", "/b")).toBeUndefined();
    expect(nitro.routing.routes.routes.map((r) => r.method)).toEqual(["GET", "GET"]);
  });

  it("runs `GET` middleware for `HEAD` requests unless `head: false`", () => {
    const nitro = createNitro([
      { route: "/a", method: "GET", handler: "./a.ts", middleware: true },
      { route: "/a", method: "GET", handler: "./b.ts", middleware: true, head: false },
    ]);
    const handlers = (method: string) =>
      nitro.routing.routedMiddleware.matchAll(method, "/a").map((h) => h.handler);
    expect(handlers("GET")).toEqual(["./a.ts", "./b.ts"]);
    expect(handlers("HEAD")).toEqual(["./a.ts"]);
  });
});
