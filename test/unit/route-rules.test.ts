import { describe, expect, it } from "vitest";
import { normalizeRouteRules } from "../../src/config/resolvers/route-rules.ts";
import { isPathInScope } from "../../src/runtime/internal/route-rules.ts";

describe("normalizeRouteRules - swr", () => {
  it("swr: true enables SWR", () => {
    const rules = normalizeRouteRules({ routeRules: { "/api/**": { swr: true } } });
    expect(rules["/api/**"].cache).toMatchObject({ swr: true });
  });

  it("swr: 60 enables SWR with maxAge", () => {
    const rules = normalizeRouteRules({ routeRules: { "/api/**": { swr: 60 } } });
    expect(rules["/api/**"].cache).toMatchObject({ swr: true, maxAge: 60 });
  });

  it("swr: 0 enables SWR with maxAge 0 (serve stale, revalidate immediately)", () => {
    const rules = normalizeRouteRules({ routeRules: { "/api/**": { swr: 0 } } });
    expect(rules["/api/**"].cache).toMatchObject({ swr: true, maxAge: 0 });
  });

  it("swr: false does not enable SWR", () => {
    const rules = normalizeRouteRules({ routeRules: { "/api/**": { swr: false } } });
    expect(rules["/api/**"].cache).toBeUndefined();
  });

  it("swr: 0 and swr: false are not equivalent", () => {
    const withZero = normalizeRouteRules({ routeRules: { "/api/**": { swr: 0 } } });
    const withFalse = normalizeRouteRules({ routeRules: { "/api/**": { swr: false } } });
    expect(withZero["/api/**"].cache).toBeTruthy();
    expect(withFalse["/api/**"].cache).toBeUndefined();
  });
});

// Regression for GHSA-5w89-w975-hf9q: an encoded traversal like `..%2f` must
// not let a request escape a `/**` proxy/redirect scope once the downstream
// decodes it.
describe("isPathInScope", () => {
  it("accepts in-scope paths", () => {
    expect(isPathInScope("/api/orders/list.json", "/api/orders")).toBe(true);
    expect(isPathInScope("/api/orders/", "/api/orders")).toBe(true);
    expect(isPathInScope("/api/orders", "/api/orders")).toBe(true);
  });

  it("rejects encoded slash traversal (%2f)", () => {
    expect(isPathInScope("/api/orders/..%2fadmin%2fconfig.json", "/api/orders")).toBe(false);
    expect(isPathInScope("/api/orders/..%2Fadmin", "/api/orders")).toBe(false);
  });

  it("rejects encoded backslash traversal (%5c)", () => {
    expect(isPathInScope("/api/orders/..%5cadmin", "/api/orders")).toBe(false);
  });

  it("rejects double-encoded dot-segments (%2E%2E)", () => {
    expect(isPathInScope("/api/orders/%2E%2E%2Fadmin", "/api/orders")).toBe(false);
  });

  it("rejects literal traversal above scope", () => {
    expect(isPathInScope("/api/orders/../admin", "/api/orders")).toBe(false);
    expect(isPathInScope("/api/orders/../../etc/passwd", "/api/orders")).toBe(false);
  });

  it("keeps traversal confined within scope", () => {
    expect(isPathInScope("/api/orders/foo/../bar", "/api/orders")).toBe(true);
    expect(isPathInScope("/api/orders/foo%2f..%2fbar", "/api/orders")).toBe(true);
  });

  it("does not confuse sibling prefix with scope", () => {
    expect(isPathInScope("/api/ordersX/list.json", "/api/orders")).toBe(false);
  });

  it("allows anything for an empty base (catch-all /**)", () => {
    expect(isPathInScope("/anything/here", "")).toBe(true);
  });
});
