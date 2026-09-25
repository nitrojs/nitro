import { describe, expect, it } from "vitest";

import { Router } from "../../src/routing.ts";

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
    expect(findRoute("GET", "/foo")).toMatchObject({ params: { _: "" } });
    expect(findRoute("GET", "/foo/")).toMatchObject({ params: { _: "" } });
    expect(findRoute("GET", "/foo/bar/baz")).toMatchObject({ params: { _: "bar/baz" } });
  });

  it("matches rou3 for a catch-all route with a baseURL", () => {
    const fastPath = compile("/foo/", [{ route: "/**", data: "catchall" }]);
    const rou3 = compile("/foo/", [
      { route: "/**", data: "catchall" },
      { route: "/other", data: "other" },
    ]);

    for (const path of ["/", "/foo", "/foo/", "/foo/bar", "/foobar"]) {
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
