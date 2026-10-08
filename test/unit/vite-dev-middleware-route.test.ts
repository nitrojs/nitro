import { describe, expect, it } from "vitest";
import { matchesMiddlewareRoute } from "../../src/build/vite/dev.ts";

describe("vite dev: matchesMiddlewareRoute", () => {
  it("matches mounted routes on a path boundary", () => {
    expect(matchesMiddlewareRoute("/api", "/api")).toBe(true);
    expect(matchesMiddlewareRoute("/api", "/api/foo")).toBe(true);
    expect(matchesMiddlewareRoute("/api", "/api.json")).toBe(true);
    expect(matchesMiddlewareRoute("/api", "/api?x=1")).toBe(true);
    expect(matchesMiddlewareRoute("/API", "/api/foo")).toBe(true);
    expect(matchesMiddlewareRoute("/api/", "/api/foo")).toBe(true);
  });

  it("does not match across a path boundary", () => {
    expect(matchesMiddlewareRoute("/api", "/apiary")).toBe(false);
    expect(matchesMiddlewareRoute("/api", "/")).toBe(false);
  });

  it("ignores unmounted middleware", () => {
    expect(matchesMiddlewareRoute("", "/api")).toBe(false);
    expect(matchesMiddlewareRoute("/", "/api")).toBe(false);
    expect(matchesMiddlewareRoute("/", "/")).toBe(false);
    expect(matchesMiddlewareRoute(undefined, "/")).toBe(false);
  });
});
