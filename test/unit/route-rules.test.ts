import { describe, expect, it } from "vitest";
import {
  isPathInScope,
  isTargetInScope,
  normalizeRedirectPath,
  resolveRedirectTarget,
} from "../../src/runtime/internal/route-rules-utils";

// Regression for GHSA-5w89-w975-hf9q: an encoded traversal like `..%2f` must
// not let a request escape a `/**` proxy scope once the upstream decodes it.
describe("isPathInScope", () => {
  it("accepts in-scope paths", () => {
    expect(isPathInScope("/api/orders/list.json", "/api/orders")).toBe(true);
    expect(isPathInScope("/api/orders/", "/api/orders")).toBe(true);
    expect(isPathInScope("/api/orders", "/api/orders")).toBe(true);
  });

  it("rejects encoded slash traversal (%2f)", () => {
    expect(
      isPathInScope("/api/orders/..%2fadmin%2fconfig.json", "/api/orders")
    ).toBe(false);
    expect(isPathInScope("/api/orders/..%2Fadmin", "/api/orders")).toBe(false);
  });

  it("rejects encoded backslash traversal (%5c)", () => {
    expect(isPathInScope("/api/orders/..%5cadmin", "/api/orders")).toBe(false);
  });

  it("rejects double-encoded dot-segments (%2E%2E)", () => {
    expect(isPathInScope("/api/orders/%2E%2E%2Fadmin", "/api/orders")).toBe(
      false
    );
  });

  it("rejects literal traversal above scope", () => {
    expect(isPathInScope("/api/orders/../admin", "/api/orders")).toBe(false);
    expect(isPathInScope("/api/orders/../../etc/passwd", "/api/orders")).toBe(
      false
    );
  });

  it("keeps traversal confined within scope", () => {
    expect(isPathInScope("/api/orders/foo/../bar", "/api/orders")).toBe(true);
    expect(isPathInScope("/api/orders/foo%2f..%2fbar", "/api/orders")).toBe(
      true
    );
  });

  it("does not confuse sibling prefix with scope", () => {
    expect(isPathInScope("/api/ordersX/list.json", "/api/orders")).toBe(false);
  });

  it("allows anything for an empty base (catch-all /**)", () => {
    expect(isPathInScope("/anything/here", "")).toBe(true);
  });
});

// Empty `//` segments and prefix re-entry must not bypass the scope check.
describe("isPathInScope (empty segments)", () => {
  it("rejects `..` absorbed by an empty segment", () => {
    expect(isPathInScope("/api//..%2fadmin", "/api")).toBe(false);
    expect(isPathInScope("/api//%2e%2e%2fadmin", "/api")).toBe(false);
    expect(
      isPathInScope("/api/orders//..%2f//..%2f//..%2froot.json", "/api/orders")
    ).toBe(false);
  });

  it("rejects nested %25 encodings", () => {
    expect(isPathInScope("/api/..%252fadmin", "/api")).toBe(false);
    expect(isPathInScope("/api/%252e%252e%252fadmin", "/api")).toBe(false);
  });

  it("allows legitimate empty segments in the tail", () => {
    expect(isPathInScope("/api//foo", "/api")).toBe(true);
    expect(isPathInScope("/api/foo//bar", "/api")).toBe(true);
  });
});

describe("isTargetInScope", () => {
  it("allows in-scope targets", () => {
    expect(isTargetInScope("http://up/safe/hello", "http://up/safe")).toBe(
      true
    );
    expect(isTargetInScope("http://up/safe", "http://up/safe")).toBe(true);
    expect(isTargetInScope("http://up/safe/a?x=..%2f", "http://up/safe")).toBe(
      true
    );
    expect(isTargetInScope("/safe/a", "/safe")).toBe(true);
  });

  it("rejects targets that escape the target base", () => {
    expect(isTargetInScope("http://up/safe/..%2fadmin", "http://up/safe")).toBe(
      false
    );
    expect(
      isTargetInScope("http://up/safe/..%2Fproxy%2Fadmin", "http://up/safe")
    ).toBe(false);
    expect(
      isTargetInScope(
        "http://up/orders/..%2f//..%2f//..%2froot.json",
        "http://up/orders"
      )
    ).toBe(false);
    expect(isTargetInScope("/safe/..%2fadmin", "/safe")).toBe(false);
  });

  it("rejects raw dot segments combined with encoded separators", () => {
    // fetch/browsers resolve raw `..` with `%2F` kept opaque
    expect(
      isTargetInScope("http://up/safe/a%2fb/../../admin", "http://up/safe")
    ).toBe(false);
    expect(isPathInScope("/api/a%2fb/../../admin", "/api")).toBe(false);
    expect(isPathInScope("/api/x%2fy%2fz/../../../admin", "/api")).toBe(false);
    expect(isPathInScope("/api/a%2F/../../secret", "/api")).toBe(false);
    expect(
      isTargetInScope("http://host/base/a%2F/../../secret", "http://host/base")
    ).toBe(false);
  });

  it("rejects double-encoded traversal without literal %25%25", () => {
    expect(isPathInScope("/api/..%25%32%66..%25%32%66admin", "/api")).toBe(
      false
    );
    expect(isPathInScope("/api/..%2%66admin", "/api")).toBe(false);
  });

  it("supports encoded or non-canonical target bases", () => {
    const gitlab = "https://gitlab.com/api/v4/projects/grp%2Fproj/repository";
    expect(isTargetInScope(`${gitlab}/files/a.txt`, gitlab)).toBe(true);
    expect(isTargetInScope(`${gitlab}/..%2f..%2fother`, gitlab)).toBe(false);
    expect(isTargetInScope("http://up/100%25/x", "http://up/100%25")).toBe(
      true
    );
    expect(isTargetInScope("http://up/v1%2E0/x", "http://up/v1%2E0")).toBe(
      true
    );
    expect(isTargetInScope("http://up/a//b/x", "http://up/a//b")).toBe(true);
    expect(isTargetInScope("http://up/a/./b/x", "http://up/a/./b")).toBe(true);
    // decoded base must not let the WHATWG reading escape
    expect(isTargetInScope("http://up/a%2Fb/../b/x", "http://up/a%2Fb")).toBe(
      false
    );
  });

  it("allows anything for a root target base", () => {
    expect(isTargetInScope("http://up/a/b", "http://up")).toBe(true);
    expect(isTargetInScope("http://up/a/b", "http://up/")).toBe(true);
  });
});

// A wildcard redirect to `/**` must never emit a `Location` that browsers
// resolve as protocol-relative (cross-origin).
describe("normalizeRedirectPath", () => {
  const resolve = (location: string) =>
    new URL(location, "https://victim.example").origin;

  it.each([
    ["//evil.example", "/evil.example"],
    ["///evil.example", "/evil.example"],
    ["/\\evil.example", "/evil.example"],
    ["/\\\\evil.example", "/evil.example"],
    ["/\\/evil.example", "/evil.example"],
    ["\\\\evil.example", "/evil.example"],
    ["/%5Cevil.example", "/evil.example"],
    ["/%5c%5cevil.example", "/evil.example"],
    ["/%5C/evil.example", "/evil.example"],
    ["/%2F%2Fevil.example", "/evil.example"],
    ["/%01/evil.example", "/evil.example"],
    ["/%1F/evil.example", "/evil.example"],
    ["/\t/evil.example", "/evil.example"],
    ["/\n/evil.example", "/evil.example"],
    ["/\r/evil.example", "/evil.example"],
    ["/%09/evil.example", "/evil.example"],
    ["/%0A/evil.example", "/evil.example"],
    ["/%0d/evil.example", "/evil.example"],
    ["/ /evil.example", "/evil.example"],
    ["/%20/evil.example", "/evil.example"],
    ["/\u0000/evil.example", "/evil.example"],
    ["/%5Cevil.example?next=x", "/evil.example?next=x"],
  ])("collapses %j", (input, expected) => {
    const out = normalizeRedirectPath(input);
    expect(out).toBe(expected);
    expect(resolve(out)).toBe("https://victim.example");
  });

  // Browsers never decode `Location` again nor strip non-ASCII whitespace,
  // so nested encodings and unicode spaces stay same-origin as-is.
  it.each([
    "/%252F%252Fevil.example",
    "/%255Cevil.example",
    "/%2520/evil.example",
    "/\u00A0/evil.example",
    "/\u00A0\\evil.example",
    "/\u3000/evil.example",
    "/\uFEFF/evil.example",
  ])("preserves non-separator prefix %j", (input) => {
    const out = normalizeRedirectPath(input);
    expect(out).toBe(input);
    expect(resolve(out)).toBe("https://victim.example");
  });

  it("keeps regular paths untouched", () => {
    expect(normalizeRedirectPath("/foo")).toBe("/foo");
    expect(normalizeRedirectPath("/foo?x=1")).toBe("/foo?x=1");
    expect(normalizeRedirectPath("/foo//bar\\baz")).toBe("/foo//bar\\baz");
    expect(normalizeRedirectPath("/")).toBe("/");
    expect(normalizeRedirectPath("")).toBe("");
  });
});

// Inputs mirror h3 v1 `event.path`: `%5C`, `%09`, `%20`... are already decoded
// to literal characters, while `%2F` stays encoded.
describe("resolveRedirectTarget", () => {
  const origin = (location: string) =>
    new URL(location, "https://victim.example").origin;

  const payloads = [
    "//evil.example",
    "///evil.example",
    "/\\evil.example",
    "/\\\\evil.example",
    "/\\/evil.example",
    "/%2F%2Fevil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r/evil.example",
    "/ /evil.example",
    "/\t\\evil.example",
    "/\\\t\\evil.example",
  ];

  describe("strip base (`/old/**` -> `/**`)", () => {
    it.each(payloads)("stays same-origin for %j", (payload) => {
      const target = resolveRedirectTarget(`/old${payload}`, "/**", "/old");
      expect(target).toBe("/evil.example");
      expect(origin(target!)).toBe("https://victim.example");
    });

    it("preserves query strings", () => {
      expect(
        resolveRedirectTarget("/old/\\evil.example?next=x", "/**", "/old")
      ).toBe("/evil.example?next=x");
    });

    it("redirects regular paths", () => {
      expect(resolveRedirectTarget("/old/foo", "/**", "/old")).toBe("/foo");
      expect(resolveRedirectTarget("/old/foo?x=1", "/**", "/old")).toBe(
        "/foo?x=1"
      );
      expect(resolveRedirectTarget("/old/a/b", "/new/**", "/old")).toBe(
        "/new/a/b"
      );
    });

    // Intentional trade-off: the whole leading run is collapsed, including
    // whitespace and encoded separators that are harmless mid-URL.
    it("strips leading whitespace and encoded separators", () => {
      expect(resolveRedirectTarget("/old/ a", "/**", "/old")).toBe("/a");
      expect(resolveRedirectTarget("/old/%2Fa", "/**", "/old")).toBe("/a");
      expect(resolveRedirectTarget("/old/a%2Fb", "/**", "/old")).toBe("/a%2Fb");
      expect(resolveRedirectTarget("/old/a b", "/**", "/old")).toBe("/a b");
    });

    it("never returns an empty location for the base itself", () => {
      expect(resolveRedirectTarget("/old", "/**", "/old")).toBe("/");
      expect(resolveRedirectTarget("/old/", "/**", "/old")).toBe("/");
      expect(resolveRedirectTarget("/old?x=1", "/**", "/old")).toBe("/?x=1");
    });

    it("rejects paths escaping the base", () => {
      expect(
        resolveRedirectTarget("/old/..%2fadmin", "/**", "/old")
      ).toBeUndefined();
      expect(
        resolveRedirectTarget("/old/../admin", "/**", "/old")
      ).toBeUndefined();
    });
  });

  describe("catch-all (`/**` -> `/**`)", () => {
    it.each(payloads)("stays same-origin for %j", (payload) => {
      const target = resolveRedirectTarget(payload, "/**");
      expect(target).toBe("/evil.example");
      expect(origin(target!)).toBe("https://victim.example");
    });

    it("always returns a path-absolute location", () => {
      expect(resolveRedirectTarget("evil.example", "/**")).toBe(
        "/evil.example"
      );
      expect(resolveRedirectTarget("http://evil.example/", "/**")).toBe(
        "/http://evil.example/"
      );
      expect(resolveRedirectTarget("", "/**")).toBe("/");
      expect(resolveRedirectTarget("/foo?x=1", "/**")).toBe("/foo?x=1");
    });
  });

  describe("targets with a host or path", () => {
    it("keeps an absolute target's origin", () => {
      const target = resolveRedirectTarget(
        "/abs/\\evil.example",
        "https://nitro.build/**",
        "/abs"
      );
      expect(target).toBe("https://nitro.build/evil.example");
    });

    it("keeps an intentional protocol-relative target", () => {
      expect(
        resolveRedirectTarget("/cdn/x.js", "//cdn.example/**", "/cdn")
      ).toBe("//cdn.example/x.js");
    });

    it("keeps a path-prefixed target under its prefix", () => {
      expect(
        resolveRedirectTarget("/old/\\evil.example", "/new/**", "/old")
      ).toBe("/new/evil.example");
    });

    // Normalizing the leading run must not expose a dot-segment that climbs
    // above the target prefix (`/new/\../x` -> `/new/../x` -> `/x`)
    it.each([
      "/old/\\../x",
      "/old/\\\\../x",
      "/old/ /../x",
      "/old/\t/../x",
      "/old/%2F../x",
      "/old/%2F%2e%2e/x",
      "/old/%5C../x",
      "/old//../x",
      // `%2F` is one opaque segment for browsers, so it must not absorb a `..`
      "/old/a%2F/../../x",
      "/old/x%2F%2F/../../../x",
      "/old/a%5C/../../x",
    ])("rejects prefix escape via %j", (path) => {
      expect(resolveRedirectTarget(path, "/new/**", "/old")).toBeUndefined();
      expect(
        resolveRedirectTarget(path, "https://x.example/sub/**", "/old")
      ).toBeUndefined();
      expect(
        resolveRedirectTarget(path.slice(4), "/new/**", "")
      ).toBeUndefined();
    });

    it("allows dot-segments that stay under the target prefix", () => {
      expect(resolveRedirectTarget("/old/a/../b", "/new/**", "/old")).toBe(
        "/new/a/../b"
      );
      expect(resolveRedirectTarget("/old/\\a/../b", "/new/**", "/old")).toBe(
        "/new/a/../b"
      );
    });
  });

  describe("non-wildcard targets", () => {
    it("returns the target and forwards the query", () => {
      expect(resolveRedirectTarget("/rules/redirect", "/base")).toBe("/base");
      expect(resolveRedirectTarget("/rules/redirect?a=1", "/base")).toBe(
        "/base?a=1"
      );
    });
  });
});
