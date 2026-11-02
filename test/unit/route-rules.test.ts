import { describe, expect, it } from "vitest";
import {
  isPathInScope,
  isTargetInScope,
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
