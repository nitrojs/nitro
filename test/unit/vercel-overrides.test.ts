import { describe, expect, it } from "vitest";
import { getPrerenderOverrides } from "../../src/presets/vercel/utils.ts";

describe("getPrerenderOverrides", () => {
  it("returns no overrides without prerendered routes", () => {
    expect(getPrerenderOverrides()).toEqual({});
    expect(getPrerenderOverrides([])).toEqual({});
  });

  it("skips files Vercel serves as directory indexes", () => {
    expect(
      getPrerenderOverrides([
        { route: "/", fileName: "/index.html" },
        { route: "/noslash", fileName: "/noslash/index.html" },
        { route: "/nested/deep/", fileName: "/nested/deep/index.html" },
        // Extensionless index, e.g. a non-HTML route with a trailing slash
        { route: "/api/data/", fileName: "/api/data/index" },
      ])
    ).toEqual({});
  });

  // Keeping the trailing slash makes the path unmatchable (#4392)
  it("does not emit a trailing-slash path", () => {
    expect(getPrerenderOverrides([{ route: "/slash/", fileName: "/slash/index.html" }])).toEqual(
      {}
    );
    expect(getPrerenderOverrides([{ route: "/slash/", fileName: "/renamed/index.html" }])).toEqual({
      "renamed/index.html": { path: "slash" },
    });
  });

  it("overrides files that are not served at their route", () => {
    expect(
      getPrerenderOverrides([
        // `autoSubfolderIndex: false`
        { route: "/about", fileName: "/about.html" },
        { route: "/blog/post", fileName: "/blog/post.html" },
        // `fileName` rewritten in a `prerender:generate` hook
        { route: "/bar/", fileName: "/renamed/index.html" },
      ])
    ).toEqual({
      "about.html": { path: "about" },
      "blog/post.html": { path: "blog/post" },
      "renamed/index.html": { path: "bar" },
    });
  });

  // Vercel deletes the original entry when re-keying, so an override pointing a
  // file at its own path would remove it from the deployment entirely
  it("never points a file at its own path", () => {
    const overrides = getPrerenderOverrides([
      { route: "/foo.html", fileName: "/foo.html" },
      { route: "/foo/index.html", fileName: "/foo/index.html" },
      { route: "/data.json", fileName: "/data.json" },
      // Route and file name normalize to the same key despite different spelling
      { route: "/self/", fileName: "/self" },
      { route: "/about", fileName: "/about.html" },
    ]);
    for (const [file, { path }] of Object.entries(overrides)) {
      expect(path).not.toBe(file);
    }
    expect(overrides).toEqual({ "about.html": { path: "about" } });
  });

  it("ignores routes without a fileName", () => {
    expect(getPrerenderOverrides([{ route: "/skipped" }])).toEqual({});
  });

  // Vercel infers the content type from the file name, so an extensionless
  // file is served as a download unless the type is spelled out
  it("overrides the content type when the file name cannot convey it", () => {
    expect(
      getPrerenderOverrides([
        { route: "/data/", fileName: "/data/index", contentType: "application/json" },
        { route: "/feed", fileName: "/feed", contentType: "application/xml" },
      ])
    ).toEqual({
      "data/index": { contentType: "application/json" },
      feed: { contentType: "application/xml" },
    });
  });

  it("keeps serving directory indexes in place while fixing their content type", () => {
    const overrides = getPrerenderOverrides([
      { route: "/data/", fileName: "/data/index", contentType: "application/json" },
    ]);
    // A `path` here would move the file off the directory index Vercel serves
    expect(overrides["data/index"]).not.toHaveProperty("path");
  });

  it("leaves the content type to the file name whenever it conveys one", () => {
    expect(
      getPrerenderOverrides([
        { route: "/", fileName: "/index.html", contentType: "text/html; charset=utf-8" },
        { route: "/about", fileName: "/about.html", contentType: "text/html; charset=utf-8" },
        { route: "/data.json", fileName: "/data.json", contentType: "application/json" },
        // Even when the route disagrees with the extension, which is a
        // pre-existing mismatch and not this override's business
        { route: "/custom.html", fileName: "/custom.html", contentType: "text/plain" },
      ])
    ).toEqual({
      // Re-keyed, but no redundant contentType
      "about.html": { path: "about" },
    });
  });
});
