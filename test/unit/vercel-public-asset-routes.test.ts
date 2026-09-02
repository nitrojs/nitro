import { describe, expect, it } from "vitest";
import type { PublicAssetDir } from "nitro/types";
import { getPublicAssetRoutes } from "../../src/presets/vercel/utils.ts";

const asset = (dir: Partial<PublicAssetDir>): PublicAssetDir =>
  ({ dir: "public", maxAge: 0, ...dir }) as PublicAssetDir;

describe("getPublicAssetRoutes", () => {
  it("returns no routes without public assets", () => {
    expect(getPublicAssetRoutes([], "/")).toEqual([]);
  });

  it("skips assets that fall through to the server", () => {
    expect(getPublicAssetRoutes([asset({ baseURL: "/build", fallthrough: true })], "/")).toEqual(
      []
    );
  });

  // A `/(.*)` source would cache-control every response and 404 every dynamic
  // route. The runtime never treats `/` as a public asset base either.
  it("skips the root base", () => {
    expect(
      getPublicAssetRoutes(
        [asset({ baseURL: "/", fallthrough: false }), asset({ fallthrough: false })],
        "/"
      )
    ).toEqual([]);
  });

  // `/build(.*)` would also match a sibling path such as `/buildings`
  it("matches the base as a path prefix", () => {
    expect(getPublicAssetRoutes([asset({ baseURL: "/build", fallthrough: false })], "/")).toEqual([
      { src: "/build/(.*)", maxAge: 31_536_000 },
    ]);
  });

  it("prefixes sources with the app base URL", () => {
    expect(
      getPublicAssetRoutes([asset({ baseURL: "/build", fallthrough: false })], "/base")
    ).toEqual([{ src: "/base/build/(.*)", maxAge: 31_536_000 }]);
  });

  it("escapes regular expression characters in the base", () => {
    expect(getPublicAssetRoutes([asset({ baseURL: "/a.b-c", fallthrough: false })], "/")).toEqual([
      { src: String.raw`/a\.b\-c/(.*)`, maxAge: 31_536_000 },
    ]);
  });

  // Hardcoding a year would override the documented `maxAge` behavior
  it("uses the configured maxAge", () => {
    expect(
      getPublicAssetRoutes([asset({ baseURL: "/build", fallthrough: false, maxAge: 3600 })], "/")
    ).toEqual([{ src: "/build/(.*)", maxAge: 3600 }]);
  });
});
