import { describe, expect, it } from "vitest";
import {
  extractLinks,
  formatPrerenderRoute,
  matchesIgnorePattern,
} from "../../src/prerender/utils.ts";
import type { PrerenderRoute } from "nitro/types";

describe("prerender utils", () => {
  it("reports parents of crawled links by their `baseURL`-relative route", async () => {
    const links = await extractLinks(
      `<a href="/base/missing">missing</a>`,
      "/base/parent",
      new Response(),
      true,
      "/base/"
    );
    expect(links).toEqual(["/base/missing"]);

    const error = Object.assign(new Error("[404] Not Found"), { status: 404 });
    const output = formatPrerenderRoute({ route: "/missing", error } as PrerenderRoute);
    expect(output).toContain("Linked from /base/parent");
  });

  describe("matchesIgnorePattern", () => {
    const matches = (pattern: Parameters<typeof matchesIgnorePattern>[1], paths: string[]) =>
      paths.filter((path) => matchesIgnorePattern(path, pattern));
    const paths = ["/blog", "/blog/", "/blog/post", "/blog/a/b", "/blog-post", "/about"];

    it("matches a plain string as a prefix", () => {
      expect(matches("/blog", paths)).toEqual([
        "/blog",
        "/blog/",
        "/blog/post",
        "/blog/a/b",
        "/blog-post",
      ]);
      expect(matches("/blog/", paths)).toEqual(["/blog/", "/blog/post", "/blog/a/b"]);
    });

    it("matches `**` across segments", () => {
      expect(matches("/blog/**", paths)).toEqual(["/blog", "/blog/", "/blog/post", "/blog/a/b"]);
    });

    it("matches a trailing `*` across segments, like `**`", () => {
      expect(matches("/blog/*", paths)).toEqual(["/blog", "/blog/", "/blog/post", "/blog/a/b"]);
    });

    it("matches a `:param` as a single segment", () => {
      const paths = ["/users", "/users/1", "/users/1/", "/users/1/posts", "/users/1?tab=a"];
      expect(matches("/users/:id", paths)).toEqual(["/users/1", "/users/1/", "/users/1?tab=a"]);
    });

    it("matches a pattern against the path without its query", () => {
      expect(matchesIgnorePattern("/a/b/c?x=1", "/a/:id/c")).toBe(true);
    });

    it("matches a RegExp", () => {
      expect(matches(/post$/, paths)).toEqual(["/blog/post", "/blog-post"]);
    });

    it("matches a function returning `true`", () => {
      expect(matches((path) => path.includes("a/b"), paths)).toEqual(["/blog/a/b"]);
      expect(matches(() => undefined, paths)).toEqual([]);
    });
  });
});
