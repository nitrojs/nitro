import { describe, expect, it } from "vitest";
import { H3, mockEvent } from "h3";

import { Router } from "../../src/routing.ts";

// A pattern that reaches a handler in a plain h3 app must reach one through
// Nitro's compiled rou3 router too.
const cases: [pattern: string, normalized: string][] = [
  ["/about", "/about"],
  ["/について", "/%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6"],
  ["/café/**", "/caf%C3%A9/**"],
  ["/emoji/🎉", "/emoji/%F0%9F%8E%89"],
  ["/hello world", "/hello%20world"],
  ['/a"b', "/a%22b"],
  ["/tag/<x>", "/tag/%3Cx%3E"],
  ["/a`b", "/a%60b"],
  ["/%61dmin", "/admin"],
  ["/%40handle", "/@handle"],
  ["/a/./b", "/a/b"],
  ["/a/b/../c", "/a/c"],
  ["about", "/about"],
  // rou3 syntax is never encoded, even where the URL serializer would encode it
  ["/user/:id", "/user/:id"],
  ["/user/:id?", "/user/:id?"],
  ["/x/{y}", "/x/{y}"],
  ["/user/:id(\\d+)", "/user/:id(\\d+)"],
  ["/**", "/**"],
  ["/**:slug", "/**:slug"],
];

describe("Router", () => {
  it("matches a normalized pattern against a wire pathname", () => {
    const router = new Router<string>();
    router._update(cases.map(([route]) => ({ route, method: "", data: route })));
    for (const [pattern] of cases) {
      expect(router.match("", eventPathname(pattern)), pattern).toBeDefined();
    }
  });

  it("agrees with h3's own route registration", async () => {
    const app = new H3();
    const router = new Router<string>();
    const literals = ["/について", "/café/x", "/hello world", '/a"b', "/tag/<x>", "/%40handle"];
    for (const route of literals) {
      app.get(route, () => "ok");
    }
    router._update(literals.map((route) => ({ route, method: "GET", data: route })));

    for (const route of literals) {
      const res = await app.fetch(new Request(`http://localhost${route}`));
      expect(res.status, `h3: ${route}`).toBe(200);
      expect(router.match("GET", eventPathname(route)), `nitro: ${route}`).toBeDefined();
    }
  });

  it("leaves patterns untouched with `normalize: false`", () => {
    const router = new Router<string>(undefined, { normalize: false });
    router._update([{ route: "/について/**", method: "", data: "rules" }]);
    // Preset code looks these up with another pattern, not a request path.
    expect(router.match("", "/について/x")).toBe("rules");
  });
});

// The pathname Nitro's compiled router is handed: h3 canonicalizes it on the
// `H3Event` before anything can match on it (`/%40handle` -> `/@handle`).
function eventPathname(route: string): string {
  return mockEvent(`http://localhost${route}`).url.pathname;
}
