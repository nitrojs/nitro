import { describe, expect, it } from "vitest";
import { normalizeRouteRules } from "../../src/config/resolvers/route-rules.ts";

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
