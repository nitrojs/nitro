import { createRouter, toRouteMatcher } from "radix3";
import { joinURL, withoutBase } from "ufo";
import { describe, expect, it } from "vitest";
import {
  getRedirectLocation,
  routeToVercelSrc,
} from "../../src/presets/vercel/utils";

const patterns = [
  "/",
  "/**",
  "/api/**",
  "/x/*",
  "/x/:id",
  "/x/:id/edit",
  "/x/*/y/**",
  "/exact",
  "/exact/nested",
  "/dot.v1/**",
  "/a+b(c)/[d]",
];

const paths = [
  "/",
  "/api",
  "/api/",
  "/api/a",
  "/api/a/b/",
  "/apix",
  "/x",
  "/x/",
  "/x/1",
  "/x/1/",
  "/x/1/2",
  "/x/1/edit",
  "/x/1/y",
  "/x/1/y/z/",
  "/exact",
  "/exact/",
  "/exactly",
  "/exact/nested",
  "/prefix/exact",
  "/dot.v1",
  "/dot.v1/a",
  "/dotxv1/a",
  "/a+b(c)/[d]",
  "/aab(c)/[d]",
];

describe("routeToVercelSrc", () => {
  for (const baseURL of ["/", "/base/"]) {
    it(`matches the same paths as the runtime matcher (baseURL: ${baseURL})`, () => {
      for (const pattern of patterns) {
        const matcher = toRouteMatcher(
          createRouter({ routes: { [pattern]: { pattern } } })
        );
        const src = new RegExp(`^${routeToVercelSrc(pattern, baseURL)}$`);
        for (const path of paths) {
          const fullPath = joinURL(baseURL, path);
          expect
            .soft(src.test(fullPath), `${pattern} ~ ${fullPath}`)
            .toBe(matcher.matchAll(path).length > 0);
        }
      }
    });
  }

  it("does not match paths outside of the baseURL", () => {
    const src = new RegExp(`^${routeToVercelSrc("/api/**", "/base/")}$`);
    expect(src.test("/api/a")).toBe(false);
    expect(src.test("/base/api/a")).toBe(true);
  });

  it("generates readable sources", () => {
    expect(routeToVercelSrc("/")).toBe("/");
    expect(routeToVercelSrc("/", "/base/")).toBe("/base/?");
    expect(routeToVercelSrc("/**")).toBe("(?:/(.*))?");
    expect(routeToVercelSrc("/api/**")).toBe("/api(?:/(.*))?");
    expect(routeToVercelSrc("/x/:id")).toBe("/x/[^/]+/?");
    expect(routeToVercelSrc("/dot.v1/**", "/base/")).toBe(
      String.raw`/base/dot\.v1(?:/(.*))?`
    );
  });
});

describe("getRedirectLocation", () => {
  it("keeps targets without a wildcard", () => {
    expect(getRedirectLocation("/old/**", "/new")).toBe("/new");
    expect(getRedirectLocation("/old", "https://nitro.build/")).toBe(
      "https://nitro.build/"
    );
  });

  it("expands a trailing wildcard like the runtime", () => {
    const route = "/old/**";
    const location = getRedirectLocation(route, "/new/**")!;
    const src = new RegExp(`^${routeToVercelSrc(route)}$`);
    for (const path of ["/old/a", "/old/a/b", "/old/a/"]) {
      const runtime = joinURL("/new", withoutBase(path, "/old"));
      expect(path.replace(src, location)).toBe(runtime);
    }
    expect(getRedirectLocation("/old/**", "/**")).toBe("/$1");
  });

  it("leaves targets the edge cannot expand to the server function", () => {
    expect(getRedirectLocation("/old/*", "/new/**")).toBeUndefined();
    expect(getRedirectLocation("/old/**", "/new/**/a")).toBeUndefined();
    expect(getRedirectLocation("/old/**", "/new?path=/**")).toBeUndefined();
  });
});
