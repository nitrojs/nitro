import { describe, expect, it } from "vitest";
import type { Nitro, NitroEventHandler, NitroRouteRules, PrerenderRoute } from "nitro/types";

import { getObservabilityRoutes } from "../../src/presets/vercel/utils.ts";
import { Router } from "../../src/routing.ts";

function createNitroStub(opts: {
  compatibilityDate?: string;
  handlers?: NitroEventHandler[];
  ssrRoutes?: string[];
  prerenderedRoutes?: PrerenderRoute[];
  routeRules?: Record<string, NitroRouteRules>;
}): Nitro {
  const routeRules = new Router<NitroRouteRules>();
  routeRules._update(
    Object.entries(opts.routeRules || {}).map(([route, data]) => ({ route, method: "", data }))
  );
  return {
    scannedHandlers: opts.handlers || [],
    _prerenderedRoutes: opts.prerenderedRoutes,
    routing: { routeRules },
    options: {
      compatibilityDate: { default: opts.compatibilityDate || "2025-07-15" },
      handlers: [],
      ssrRoutes: opts.ssrRoutes || [],
      routeRules: opts.routeRules || {},
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

  // Regression: https://github.com/nitrojs/nitro/issues/4447
  //
  // ISR-ruled paths are served through the ISR rewrite machinery, so they must
  // get neither an observability function nor a `config.json` route entry.
  // The skip used to be decided against the *compiled* `src`: a `:param`
  // segment compiles to `(?<id>[^/]+)`, whose literal `/` inside the character
  // class splits into extra path segments, so `/users/:id` never matched its
  // own rule and the build emitted a plain function competing with the ISR one.
  describe("ISR route rules", () => {
    it("skips a dynamic route whose rule enables ISR", () => {
      expect(
        getObservabilityRoutes(
          createNitroStub({
            handlers: [{ route: "/users/:id", handler: "user.ts" }],
            routeRules: { "/users/:id": { isr: 60 } },
          })
        )
      ).toEqual([]);
    });

    it("skips static and catch-all routes whose rule enables ISR", () => {
      expect(
        dests(
          createNitroStub({
            handlers: [
              { route: "/schedule", handler: "schedule.ts" },
              { route: "/catchall/**", handler: "catchall.ts" },
            ],
            routeRules: { "/schedule": { isr: 300 }, "/catchall/**": { isr: 60 } },
          })
        )
      ).toEqual([]);
    });

    it("skips a route covered by a wildcard ISR rule", () => {
      expect(
        dests(
          createNitroStub({
            handlers: [{ route: "/users/:id", handler: "user.ts" }],
            routeRules: { "/users/**": { isr: 60 } },
          })
        )
      ).toEqual([]);
    });

    it("keeps routes whose rules do not enable ISR", () => {
      expect(
        dests(
          createNitroStub({
            handlers: [
              { route: "/users/:id", handler: "user.ts" },
              { route: "/plain", handler: "plain.ts" },
            ],
            routeRules: { "/users/:id": { isr: false }, "/plain": { swr: true } },
          })
        )
      ).toEqual(["plain", "users/[id]"]);
    });

    it("keeps routes when no rule matches", () => {
      expect(
        dests(
          createNitroStub({
            handlers: [{ route: "/users/:id", handler: "user.ts" }],
            routeRules: { "/other/**": { isr: 60 } },
          })
        )
      ).toEqual(["users/[id]"]);
    });
  });
});
