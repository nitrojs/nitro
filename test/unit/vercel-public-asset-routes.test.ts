import { describe, expect, it } from "vitest";
import type { PublicAssetDir } from "nitro/types";
import { getPublicAssetRoutes } from "../../src/presets/vercel/utils.ts";

const asset = (dir: Partial<PublicAssetDir>): PublicAssetDir =>
  ({ dir: "public", maxAge: 0, ...dir }) as PublicAssetDir;

const ONE_YEAR = "public, max-age=31536000, immutable";

describe("getPublicAssetRoutes", () => {
  it("returns no routes without public assets", () => {
    expect(getPublicAssetRoutes([], { baseURL: "/", routeRules: {} })).toEqual([]);
  });

  it("skips assets that fall through to the server", () => {
    expect(
      getPublicAssetRoutes([asset({ baseURL: "/build", fallthrough: true })], {
        baseURL: "/",
        routeRules: {},
      })
    ).toEqual([]);
  });

  // A `/(.*)` source would cache-control every response and 404 every dynamic
  // route. The runtime never treats `/` as a public asset base either.
  it("skips the root base", () => {
    expect(
      getPublicAssetRoutes(
        [asset({ baseURL: "/", fallthrough: false }), asset({ fallthrough: false })],
        {
          baseURL: "/",
          routeRules: {},
        }
      )
    ).toEqual([]);
  });

  // `/build(.*)` would also match a sibling path such as `/buildings`
  it("matches the base as a path prefix", () => {
    expect(
      getPublicAssetRoutes([asset({ baseURL: "/build", fallthrough: false })], {
        baseURL: "/",
        routeRules: {},
      })
    ).toEqual([{ src: "/build/(.*)", cacheControl: ONE_YEAR }]);
  });

  it("prefixes sources with the app base URL", () => {
    expect(
      getPublicAssetRoutes([asset({ baseURL: "/build", fallthrough: false })], {
        baseURL: "/base",
        routeRules: {},
      })
    ).toEqual([{ src: "/base/build/(.*)", cacheControl: ONE_YEAR }]);
  });

  it("escapes regular expression characters in the base", () => {
    expect(
      getPublicAssetRoutes([asset({ baseURL: "/a.b-c", fallthrough: false })], {
        baseURL: "/",
        routeRules: {},
      })
    ).toEqual([{ src: String.raw`/a\.b\-c/(.*)`, cacheControl: ONE_YEAR }]);
  });

  // A `maxAge` is resolved into a route rule, which is emitted as its own route
  it("leaves the header to an existing cache-control route rule", () => {
    expect(
      getPublicAssetRoutes([asset({ baseURL: "/build", fallthrough: false, maxAge: 3600 })], {
        baseURL: "/",
        routeRules: { "/build/**": { headers: { "cache-control": "public, max-age=3600" } } },
      })
    ).toEqual([{ src: "/build/(.*)", cacheControl: undefined }]);
  });

  it("leaves the header to a cache-control route rule of any casing", () => {
    expect(
      getPublicAssetRoutes([asset({ baseURL: "/build", fallthrough: false })], {
        baseURL: "/",
        routeRules: { "/build/**": { headers: { "Cache-Control": "no-store" } } },
      })
    ).toEqual([{ src: "/build/(.*)", cacheControl: undefined }]);
  });

  it("still caches when a route rule sets other headers", () => {
    expect(
      getPublicAssetRoutes([asset({ baseURL: "/build", fallthrough: false })], {
        baseURL: "/",
        routeRules: { "/build/**": { headers: { "x-test": "test" } } },
      })
    ).toEqual([{ src: "/build/(.*)", cacheControl: ONE_YEAR }]);
  });

  // Hardcoding a year would override the documented `maxAge` behavior
  it("uses the configured maxAge without a route rule", () => {
    expect(
      getPublicAssetRoutes([asset({ baseURL: "/build", fallthrough: false, maxAge: 3600 })], {
        baseURL: "/",
        routeRules: {},
      })
    ).toEqual([{ src: "/build/(.*)", cacheControl: "public, max-age=3600, immutable" }]);
  });
});
