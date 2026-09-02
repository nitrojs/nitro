import { describe, expect, it } from "vitest";
import type { Nitro, NitroEventHandler, PrerenderRoute } from "nitro/types";

import { getObservabilityRoutes } from "../../src/presets/vercel/utils.ts";

function createNitroStub(opts: {
  compatibilityDate?: string;
  handlers?: NitroEventHandler[];
  ssrRoutes?: string[];
  prerenderedRoutes?: PrerenderRoute[];
}): Nitro {
  return {
    scannedHandlers: opts.handlers || [],
    _prerenderedRoutes: opts.prerenderedRoutes,
    options: {
      compatibilityDate: { default: opts.compatibilityDate || "2025-07-15" },
      handlers: [],
      ssrRoutes: opts.ssrRoutes || [],
    },
  } as unknown as Nitro;
}

const dests = (nitro: Nitro) => getObservabilityRoutes(nitro).map((route) => route.dest);

describe("getObservabilityRoutes", () => {
  it("returns no routes before the observability compatibility date", () => {
    expect(
      getObservabilityRoutes(
        createNitroStub({
          compatibilityDate: "2025-07-14",
          handlers: [{ route: "/foo", handler: "foo.ts" }],
        })
      )
    ).toEqual([]);
  });

  it("creates a route per handler, most specific first", () => {
    expect(
      getObservabilityRoutes(
        createNitroStub({
          handlers: [
            { route: "/**", handler: "catch-all.ts" },
            { route: "/blog/:slug", handler: "blog.ts" },
            { route: "/foo", handler: "foo.ts" },
            { route: "/skipped", handler: "middleware.ts", middleware: true },
          ],
          ssrRoutes: ["/"],
        })
      )
    ).toEqual([
      { src: "/foo", dest: "foo" },
      { src: "/", dest: "index" },
      { src: "/blog/(?<slug>[^/]+)", dest: "blog/[slug]" },
      { src: "/(?:.*)", dest: "[...]" },
    ]);
  });

  // Vercel keeps functions and static files in a single path -> output map and
  // lets the function win, so a function at the path of a prerendered file
  // hides it and serves the route with SSR on every request (#4242)
  it("skips routes served by a prerendered file", () => {
    expect(
      dests(
        createNitroStub({
          handlers: [
            { route: "/prerendered", handler: "prerendered.ts" },
            { route: "/dynamic", handler: "dynamic.ts" },
          ],
          prerenderedRoutes: [{ route: "/prerendered", fileName: "/prerendered/index.html" }],
        })
      )
    ).toEqual(["dynamic"]);
  });

  it("skips prerendered ssrRoutes and explicit handlers alike", () => {
    expect(
      dests(
        createNitroStub({
          ssrRoutes: ["/from-ssr-routes"],
          handlers: [{ route: "/from-handlers", handler: "handler.ts" }],
          prerenderedRoutes: [
            { route: "/from-ssr-routes", fileName: "/from-ssr-routes/index.html" },
            { route: "/from-handlers", fileName: "/from-handlers/index.html" },
          ],
        })
      )
    ).toEqual([]);
  });

  // Vercel matches paths without surrounding slashes, so the route and the
  // prerendered path have to be compared slash-free (#4392)
  it("matches prerendered routes regardless of a trailing slash", () => {
    expect(
      dests(
        createNitroStub({
          handlers: [{ route: "/slash", handler: "slash.ts" }],
          prerenderedRoutes: [{ route: "/slash/", fileName: "/slash/index.html" }],
        })
      )
    ).toEqual([]);
    expect(
      dests(
        createNitroStub({
          handlers: [{ route: "/slash/", handler: "slash.ts" }],
          prerenderedRoutes: [{ route: "/slash", fileName: "/slash.html" }],
        })
      )
    ).toEqual([]);
  });

  // The root function is written to `index.func`, which shadows `index.html`
  it("skips the root route when it is prerendered", () => {
    expect(
      dests(
        createNitroStub({
          handlers: [{ route: "/", handler: "index.ts" }],
          prerenderedRoutes: [{ route: "/", fileName: "/index.html" }],
        })
      )
    ).toEqual([]);
  });

  // A dynamic function still has to serve every path that was not prerendered,
  // and its output path never collides with a resolved prerendered path
  it("keeps dynamic routes with prerendered leaves", () => {
    expect(
      dests(
        createNitroStub({
          handlers: [
            { route: "/blog/:slug", handler: "blog.ts" },
            { route: "/docs/**", handler: "docs.ts" },
          ],
          prerenderedRoutes: [
            { route: "/blog/post", fileName: "/blog/post/index.html" },
            { route: "/docs/nested/page", fileName: "/docs/nested/page/index.html" },
          ],
        })
      )
    ).toEqual(["blog/[slug]", "docs/[...]"]);
  });

  it("keeps routes whose prerendered file was not written", () => {
    expect(
      dests(
        createNitroStub({
          handlers: [{ route: "/failed", handler: "failed.ts" }],
          prerenderedRoutes: [{ route: "/failed" }],
        })
      )
    ).toEqual(["failed"]);
  });

  it("keeps routes without prerendering", () => {
    expect(dests(createNitroStub({ handlers: [{ route: "/foo", handler: "foo.ts" }] }))).toEqual([
      "foo",
    ]);
  });
});
