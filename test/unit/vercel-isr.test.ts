import { describe, expect, it } from "vitest";
import { isrRouteRewrite } from "../../src/presets/vercel/runtime/isr.ts";

describe("isrRouteRewrite", () => {
  it("returns undefined when there is no ISR routing param", () => {
    expect(isrRouteRewrite("/index-isr", null)).toBeUndefined();
    expect(isrRouteRewrite("/index-isr?foo=bar", null)).toBeUndefined();
    expect(isrRouteRewrite("/index-isr", "foo=bar")).toBeUndefined();
  });

  describe("header-less branch (query on request URL)", () => {
    it("rewrites to the ISR route and drops the routing param", () => {
      expect(isrRouteRewrite("/index-isr?__isr_route=%2F", null)).toEqual(["/", ""]);
    });

    it("preserves other query params", () => {
      expect(isrRouteRewrite("/index-isr?__isr_route=%2F&lang=es", null)).toEqual(["/", "lang=es"]);
    });
  });

  describe("x-now-route-matches branch", () => {
    it("rewrites to the ISR route", () => {
      expect(isrRouteRewrite("/index-isr?__isr_route=%2F", "__isr_route=%2F")).toEqual(["/", ""]);
    });

    // Regression: https://github.com/nitrojs/nitro/issues/4408
    // The query string (allowQuery/passQuery params) must reach the render.
    it("preserves allowQuery params from x-now-route-matches", () => {
      expect(
        isrRouteRewrite("/index-isr?__isr_route=%2F&lang=es", "__isr_route=%2F&lang=es")
      ).toEqual(["/", "lang=es"]);
    });

    it("preserves allowQuery params from the request URL", () => {
      expect(isrRouteRewrite("/index-isr?__isr_route=%2F&lang=es", "__isr_route=%2F")).toEqual([
        "/",
        "lang=es",
      ]);
    });

    it("skips Vercel numeric regex-capture groups", () => {
      expect(
        isrRouteRewrite(
          "/posts/hello-isr?__isr_route=%2Fposts%2Fhello&lang=es",
          "0=%2Fposts%2Fhello&__isr_route=%2Fposts%2Fhello&lang=es"
        )
      ).toEqual(["/posts/hello", "lang=es"]);
    });

    // Regression: named route capture groups (e.g. `slug` for `/posts/:slug`)
    // are emitted by normalizeRouteSrc and echoed in `x-now-route-matches`.
    // They must not leak into the preserved query.
    it("skips Vercel named regex-capture groups", () => {
      expect(
        isrRouteRewrite(
          "/posts/hello-isr?__isr_route=%2Fposts%2Fhello&lang=es",
          "slug=hello&__isr_route=%2Fposts%2Fhello&lang=es"
        )
      ).toEqual(["/posts/hello", "lang=es"]);
    });

    it("preserves repeated (array-style) query params", () => {
      expect(isrRouteRewrite("/index-isr?__isr_route=%2F&tag=a&tag=b", "__isr_route=%2F")).toEqual([
        "/",
        "tag=a&tag=b",
      ]);
    });
  });

  // Regression: the routing param is already percent-decoded once by
  // `URLSearchParams`, so it must NOT be decoded a second time. A redundant
  // `decodeURIComponent` over-decodes encoded slugs and throws `URIError` on a
  // literal `%` (e.g. `/posts/100%off`), crashing the function.
  describe("percent-encoded routes are decoded exactly once", () => {
    it("does not throw on a route containing a literal percent", () => {
      // Vercel delivers slug `100%off` as `__isr_route=%2Fposts%2F100%25off`.
      expect(isrRouteRewrite("/x?__isr_route=%2Fposts%2F100%25off", null)).toEqual([
        "/posts/100%off",
        "",
      ]);
    });

    it("does not over-decode an encoded sequence in the route", () => {
      // Slug `a%2520b` arrives as `__isr_route=%2Fposts%2Fa%252520b`.
      expect(isrRouteRewrite("/x?__isr_route=%2Fposts%2Fa%252520b", null)).toEqual([
        "/posts/a%2520b",
        "",
      ]);
    });

    it("decodes the header branch exactly once too", () => {
      expect(isrRouteRewrite("/x", "__isr_route=%2Fposts%2F100%25off")).toEqual([
        "/posts/100%off",
        "",
      ]);
    });
  });
});
