import type { H3Event } from "h3";
import { describe, expect, it } from "vitest";
import { normalizeRouteRules } from "../../src/config/resolvers/route-rules.ts";
import {
  canonicalPath,
  isPathInScope,
  resolveWildcardTarget,
} from "../../src/runtime/internal/route-rules.ts";

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

// Used to match route rules: encoded separators must be decoded so a request
// cannot dodge a narrower rule (e.g. a `basicAuth` gate) that a broader rule
// would still serve once the downstream decodes them back to `/`.
describe("canonicalPath", () => {
  it("decodes encoded path separators", () => {
    expect(canonicalPath("/app/admin%2fpanel")).toBe("/app/admin/panel");
    expect(canonicalPath("/app/admin%2Fpanel")).toBe("/app/admin/panel");
    expect(canonicalPath("/app/admin%5cpanel")).toBe("/app/admin/panel");
  });

  it("resolves traversal revealed by decoding", () => {
    expect(canonicalPath("/api/orders/..%2fadmin")).toBe("/api/admin");
  });

  it("resolves plain dot segments", () => {
    expect(canonicalPath("/a/./b")).toBe("/a/b");
    expect(canonicalPath("/a/b/../c")).toBe("/a/c");
  });

  it("leaves a plain path untouched", () => {
    expect(canonicalPath("/app/admin/panel")).toBe("/app/admin/panel");
  });

  it("keeps a dotted filename on the fast path", () => {
    // A `.` inside a segment cannot change the path, so an asset request (the
    // hot path) must not pay for the split/normalize/join.
    expect(canonicalPath("/assets/app.1a2b.js")).toBe("/assets/app.1a2b.js");
  });

  it("keeps %20 / non-ASCII encodings in sync with event.url.pathname", () => {
    // srvx keeps `%20` and percent-encoded non-ASCII opaque in
    // `event.url.pathname` (it is not `decodeURI`-d), so canonicalization must
    // leave them encoded too — decoding would desync the canonical path from
    // how route rules are matched.
    expect(canonicalPath("/foo%20bar")).toBe("/foo%20bar");
    expect(canonicalPath("/caf%C3%A9/x")).toBe("/caf%C3%A9/x");
  });

  it("keeps non-separator reserved encodings opaque", () => {
    expect(canonicalPath("/a%3Ab")).toBe("/a%3Ab");
  });
});

// Hardening: a `/**` proxy/redirect target must keep the forwarded upstream
// request within the configured upstream base, regardless of how the incoming
// path is shaped (repeated/leading slashes, `/./`, mixed-case or double-encoded
// separators). The scope check runs on the final resolved target, so equivalent
// inputs cannot diverge from what actually gets forwarded.
describe("resolveWildcardTarget", () => {
  const to = "http://upstream/orders/**";
  const base = "/api/orders";
  const evt = (rawPath: string) => ({ url: new URL("http://localhost" + rawPath) }) as H3Event;
  const resolve = (rawPath: string) => resolveWildcardTarget(evt(rawPath), to, base);
  const blocked = (rawPath: string) => {
    try {
      resolve(rawPath);
    } catch (error: any) {
      return error?.status === 400;
    }
    return false;
  };

  it("forwards benign in-scope requests unchanged", () => {
    expect(resolve("/api/orders/list.json")).toBe("http://upstream/orders/list.json");
    expect(new URL(resolve("/api/orders/123?x=1")).pathname).toBe("/orders/123");
    // an encoded separator inside a segment stays opaque and in-scope
    expect(resolve("/api/orders/foo%2f..%2fbar")).toBe("http://upstream/orders/foo%2f..%2fbar");
  });

  it("blocks encoded traversal in every equivalent shape", () => {
    expect(blocked("/api/orders/..%2fadmin%2fconfig.json")).toBe(true); // single slash
    expect(blocked("/api/orders//..%2fadmin%2fconfig.json")).toBe(true); // doubled slash
    expect(blocked("/api/orders/..%2Fadmin")).toBe(true); // mixed-case %2F
    expect(blocked("/api/orders//..%252fadmin")).toBe(true); // doubled + double-encoded
    expect(blocked("/api/orders/%2e%2e%2fadmin")).toBe(true); // encoded dot-segment
  });

  it("never resolves a /** target outside the configured base", () => {
    const payloads = [
      "/api/orders/list.json",
      "/api/orders/",
      "/api/orders//..%2fadmin",
      "/api/orders//..%2f..%2fetc%2fpasswd",
      "/api/orders/foo%2f..%2fbar",
      "/api/orders/a//b%2f..%2f..%2fc",
      "/api/orders//..%255c..%255cwin",
      "/api/orders/%2e%2e%2f%2e%2e%2froot",
    ];
    for (const p of payloads) {
      let target: string | undefined;
      try {
        target = resolve(p);
      } catch (error: any) {
        expect(error?.status).toBe(400); // out-of-scope inputs are rejected
        continue;
      }
      // whatever is forwarded must canonicalize within the upstream base
      expect(isPathInScope(new URL(target).pathname, "/orders")).toBe(true);
    }
  });
});
