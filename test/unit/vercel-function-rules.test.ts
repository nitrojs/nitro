import { describe, expect, it } from "vitest";
import type { Nitro, PrerenderRoute } from "nitro/types";

import { getFunctionRulePatterns } from "../../src/presets/vercel/utils.ts";
import type { VercelServerlessFunctionConfig } from "../../src/presets/vercel/types.ts";

function createNitroStub(opts: {
  baseURL?: string;
  functionRules?: Record<string, VercelServerlessFunctionConfig>;
  prerenderedRoutes?: PrerenderRoute[];
}): Nitro {
  return {
    _prerenderedRoutes: opts.prerenderedRoutes,
    options: {
      baseURL: opts.baseURL || "/",
      vercel: { functionRules: opts.functionRules },
    },
  } as unknown as Nitro;
}

describe("getFunctionRulePatterns", () => {
  it("returns no patterns without functionRules", () => {
    expect(getFunctionRulePatterns(createNitroStub({}))).toEqual([]);
  });

  it("keeps patterns in config order", () => {
    expect(
      getFunctionRulePatterns(
        createNitroStub({
          functionRules: { "/b": { maxDuration: 1 }, "/a": { maxDuration: 2 } },
        })
      )
    ).toEqual(["/b", "/a"]);
  });

  // Vercel keeps functions and static files in a single path -> output map and
  // lets the function win, so a function at the path of a prerendered file
  // hides it and serves the route with SSR on every request (#4242)
  it("drops a pattern served by a prerendered file", () => {
    expect(
      getFunctionRulePatterns(
        createNitroStub({
          functionRules: { "/prerendered": { maxDuration: 1 }, "/dynamic": { maxDuration: 1 } },
          prerenderedRoutes: [{ route: "/prerendered", fileName: "/prerendered/index.html" }],
        })
      )
    ).toEqual(["/dynamic"]);
  });

  // Vercel matches paths without surrounding slashes, so the pattern and the
  // prerendered path have to be compared slash-free (#4392)
  it("drops a prerendered pattern regardless of a trailing slash", () => {
    expect(
      getFunctionRulePatterns(
        createNitroStub({
          functionRules: { "/slash": { maxDuration: 1 } },
          prerenderedRoutes: [{ route: "/slash/", fileName: "/slash/index.html" }],
        })
      )
    ).toEqual([]);
    expect(
      getFunctionRulePatterns(
        createNitroStub({
          functionRules: { "/slash/": { maxDuration: 1 } },
          prerenderedRoutes: [{ route: "/slash", fileName: "/slash.html" }],
        })
      )
    ).toEqual([]);
  });

  // The root function is written to `index.func`, which shadows `index.html`
  it("drops the root pattern when it is prerendered", () => {
    expect(
      getFunctionRulePatterns(
        createNitroStub({
          functionRules: { "/": { maxDuration: 1 } },
          prerenderedRoutes: [{ route: "/", fileName: "/index.html" }],
        })
      )
    ).toEqual([]);
  });

  // A dynamic function still has to serve every path that was not prerendered,
  // and its output path never collides with a resolved prerendered path
  it("keeps dynamic patterns with prerendered leaves", () => {
    expect(
      getFunctionRulePatterns(
        createNitroStub({
          functionRules: { "/blog/:slug": { maxDuration: 1 }, "/docs/**": { maxDuration: 1 } },
          prerenderedRoutes: [
            { route: "/blog/post", fileName: "/blog/post/index.html" },
            { route: "/docs/nested/page", fileName: "/docs/nested/page/index.html" },
          ],
        })
      )
    ).toEqual(["/blog/:slug", "/docs/**"]);
  });

  it("keeps patterns whose prerendered file was not written", () => {
    expect(
      getFunctionRulePatterns(
        createNitroStub({
          functionRules: { "/failed": { maxDuration: 1 } },
          prerenderedRoutes: [{ route: "/failed" }],
        })
      )
    ).toEqual(["/failed"]);
  });

  it("keeps patterns without prerendering", () => {
    expect(
      getFunctionRulePatterns(createNitroStub({ functionRules: { "/foo": { maxDuration: 1 } } }))
    ).toEqual(["/foo"]);
  });

  // Keys are hand written, so `/foo`, `/foo/` and `foo` all mean the same
  // route. A trailing slash left on a kept pattern reaches `normalizeRouteDest`
  // and writes a directory literally named `.func` (`functions/kept/.func`)
  it("normalizes kept patterns to a single route", () => {
    expect(
      getFunctionRulePatterns(
        createNitroStub({
          functionRules: {
            "/kept/": { maxDuration: 1 },
            noslash: { maxDuration: 1 },
            "/": { maxDuration: 1 },
            "/docs/**": { maxDuration: 1 },
          },
        })
      )
    ).toEqual(["/kept", "/noslash", "/", "/docs/**"]);
  });

  // `route` keeps the base for crawled routes but not for routes listed in
  // `prerender.routes`, so both have to resolve to the same path — otherwise
  // one deployment answers differently depending on how the route was found
  it.each([
    ["listed in prerender.routes", "/foo"],
    ["found by the crawler", "/base/foo"],
  ])("drops a prerendered pattern under a non-root baseURL (%s)", (_label, route) => {
    expect(
      getFunctionRulePatterns(
        createNitroStub({
          baseURL: "/base/",
          functionRules: { "/foo": { maxDuration: 1 } },
          prerenderedRoutes: [{ route, fileName: "/foo/index.html" }],
        })
      )
    ).toEqual([]);
  });
});
