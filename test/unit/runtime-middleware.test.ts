import { describe, expect, it, vi } from "vitest";
import { HTTPError, mockEvent } from "h3";
import type { Middleware } from "h3";

const { findRouteRules } = vi.hoisted(() => ({
  findRouteRules: vi.fn(() => []),
}));

vi.mock("#nitro/virtual/routing", () => ({ findRouteRules }));
vi.mock("#nitro/virtual/app", () => ({
  createNitroApp: () => ({}),
  initNitroPlugins: () => {},
}));

const { createMethodNotAllowedMatcher, createRouteRulesMiddleware, createRoutedMiddleware } =
  await import("../../src/runtime/internal/app.ts");

describe("runtime middleware wrappers", () => {
  it("are opted out of h3 tracing", () => {
    expect((createRouteRulesMiddleware() as any).__traced__).toBe(true);
    expect((createRoutedMiddleware(() => []) as any).__traced__).toBe(true);
  });

  it("route rules: calls next directly when no rule middleware matched", async () => {
    const middleware = createRouteRulesMiddleware();
    const next = vi.fn(() => "handler");
    expect(await middleware(mockEvent("/nothing"), next)).toBe("handler");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("routed: composes the matched chain once per handler set and runs it in order", async () => {
    const calls: string[] = [];
    const a: Middleware = (event, next) => {
      calls.push("a");
      return next();
    };
    const b: Middleware = (event, next) => {
      calls.push("b");
      return next();
    };
    const entryA = { data: a };
    const entryB = { data: b };
    const find = vi.fn((_method: string, pathname: string) =>
      pathname.startsWith("/ab") ? [entryA, entryB] : pathname.startsWith("/a") ? [entryA] : []
    );
    const middleware = createRoutedMiddleware(find);

    const next = vi.fn(() => "handler");
    expect(await middleware(mockEvent("/ab/1"), next)).toBe("handler");
    expect(calls).toEqual(["a", "b"]);
    expect(await middleware(mockEvent("/ab/2"), next)).toBe("handler");
    expect(await middleware(mockEvent("/a/1"), next)).toBe("handler");
    expect(calls).toEqual(["a", "b", "a", "b", "a"]);
    expect(next).toHaveBeenCalledTimes(3);

    // No match: next is called without composing anything.
    expect(await middleware(mockEvent("/x"), next)).toBe("handler");
    expect(calls).toHaveLength(5);
    expect(next).toHaveBeenCalledTimes(4);
  });

  it("routed: a short-circuiting routed middleware stops the chain", async () => {
    const stop: Middleware = () => "stopped";
    const middleware = createRoutedMiddleware(() => [{ data: stop }]);
    const next = vi.fn();
    expect(await middleware(mockEvent("/a"), next)).toBe("stopped");
    expect(next).not.toHaveBeenCalled();
  });

  it("method not allowed: matches nothing when the path is not routed", () => {
    const find = createMethodNotAllowedMatcher(() => undefined, ["GET", "POST"]);
    expect(find("GET", "/x")).toBeUndefined();
  });

  it("method not allowed: responds with `405` and the allowed methods", () => {
    const routes: Record<string, string[]> = { "/x": ["DELETE", "GET", "PUT"], "/y": ["POST"] };
    const findRoute = vi.fn((method: string, pathname: string) =>
      routes[pathname]?.includes(method) ? {} : undefined
    );
    const find = createMethodNotAllowedMatcher(findRoute, ["DELETE", "GET", "POST", "PUT"]);
    const route = find("POST", "/x")!;
    expect(findRoute).not.toHaveBeenCalledWith("POST", "/x");
    const error = route.data.handler(mockEvent("/x", { method: "POST" })) as HTTPError;
    expect(error).toBeInstanceOf(HTTPError);
    expect(error.status).toBe(405);
    expect(error.headers?.get("allow")).toBe("DELETE, GET, PUT");
    expect(error.message).toBe("Method POST is not allowed for /x (allowed: DELETE, GET, PUT)");
  });
});
