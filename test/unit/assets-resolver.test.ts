import { describe, expect, it } from "vitest";
import type { NitroOptions } from "nitro/types";
import { resolveAssetsOptions } from "../../src/config/resolvers/assets.ts";

// `rootDir` intentionally has no `public/` directory, so only the configured
// public assets are resolved.
const options = (publicAssets: NitroOptions["publicAssets"], routeRules = {}) =>
  ({
    rootDir: "/app",
    serverDir: "/app/server",
    scanDirs: [],
    publicAssets,
    serverAssets: [],
    routeRules,
  }) as unknown as NitroOptions;

describe("resolveAssetsOptions - publicAssets maxAge", () => {
  // A `maxAge` of `0` must stay distinguishable from an unset one, so that
  // presets can tell "no caching" from "no preference" (#4474)
  it("keeps an unset maxAge unset", async () => {
    const opts = options([{ baseURL: "/build", dir: "public/build" } as any]);
    await resolveAssetsOptions(opts);
    expect(opts.publicAssets[0].maxAge).toBeUndefined();
    expect(opts.routeRules["/build/**"]).toBeUndefined();
  });

  it("keeps an explicit maxAge of 0", async () => {
    const opts = options([{ baseURL: "/build", dir: "public/build", maxAge: 0 }]);
    await resolveAssetsOptions(opts);
    expect(opts.publicAssets[0].maxAge).toBe(0);
    expect(opts.routeRules["/build/**"]).toBeUndefined();
  });

  it("infers a cache-control route rule from a positive maxAge", async () => {
    const opts = options([{ baseURL: "/build", dir: "public/build", maxAge: 3600 }]);
    await resolveAssetsOptions(opts);
    expect(opts.publicAssets[0].maxAge).toBe(3600);
    expect(opts.routeRules["/build/**"]).toMatchObject({
      headers: { "cache-control": "public, max-age=3600, immutable" },
    });
  });

  it("infers maxAge from a cache route rule", async () => {
    const opts = options([{ baseURL: "/build", dir: "public/build" } as any], {
      "/build/**": { cache: { maxAge: 60 } },
    });
    await resolveAssetsOptions(opts);
    expect(opts.publicAssets[0].maxAge).toBe(60);
  });
});
