import { describe, expect, it, vi } from "vitest";
import type { Nitro, NitroConfig, PublicAssetDir } from "nitro/types";
import { normalizeRouteRules } from "../../src/config/resolvers/route-rules.ts";
import { getPublicAssetCorsHeaders } from "../../src/presets/_utils/cors.ts";

const CORS = { "access-control-allow-origin": "*", "access-control-expose-headers": "*" };

function createNitro(
  routeRules: NitroConfig["routeRules"],
  publicAssets: Partial<PublicAssetDir>[] = [{ baseURL: "/build" }]
) {
  return {
    logger: { warn: vi.fn() },
    options: {
      baseURL: "/",
      routeRules: normalizeRouteRules({ routeRules }),
      publicAssets: publicAssets.map((dir) => ({ dir: "public", ...dir })),
    },
  } as unknown as Nitro;
}

describe("getPublicAssetCorsHeaders", () => {
  it("adds the static headers of a matching `cors` rule", () => {
    expect(getPublicAssetCorsHeaders(createNitro({ "/**": { cors: true } }))).toEqual([
      { base: "/build", headers: CORS },
    ]);
    expect(getPublicAssetCorsHeaders(createNitro({ "/build/**": { cors: true } }))).toEqual([
      { base: "/build", headers: CORS },
    ]);
  });

  it("matches named catch-all rules, and not rules for the dir path only", () => {
    for (const rules of [
      { "/**:path": { cors: true } },
      { "/build/**:file": { cors: true } },
      { "/**": { cors: true }, "/build": { cors: false } },
    ] as NitroConfig["routeRules"][]) {
      const nitro = createNitro(rules);
      expect(getPublicAssetCorsHeaders(nitro)).toEqual([{ base: "/build", headers: CORS }]);
      expect(nitro.logger.warn).not.toHaveBeenCalled();
    }
  });

  it("skips fallthrough and root dirs, and dirs without `cors`", () => {
    const nitro = createNitro({ "/**": { cors: true } }, [
      { baseURL: "/" },
      {},
      { baseURL: "/build", fallthrough: true },
    ]);
    expect(getPublicAssetCorsHeaders(nitro)).toEqual([]);
    expect(getPublicAssetCorsHeaders(createNitro({ "/api/**": { cors: true } }))).toEqual([]);
  });

  it("merges rules like the runtime does", () => {
    expect(
      getPublicAssetCorsHeaders(
        createNitro({
          "/**": { cors: { exposeHeaders: ["x-a"] } },
          "/build/**": { cors: { maxAge: "60" } },
        })
      )
    ).toEqual([
      {
        base: "/build",
        headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "x-a" },
      },
    ]);
    expect(
      getPublicAssetCorsHeaders(
        createNitro({ "/**": { cors: true }, "/build/**": { cors: false } })
      )
    ).toEqual([]);
  });

  it("skips origin allowlists with a warning", () => {
    const nitro = createNitro({ "/**": { cors: { origin: ["https://nitro.build"] } } });
    expect(getPublicAssetCorsHeaders(nitro)).toEqual([]);
    expect(nitro.logger.warn).toHaveBeenCalledWith(expect.stringMatching(/`\/build`.*origins/));
  });

  it("skips dirs where a rule sets another `cors` for some files only", () => {
    const cases: NitroConfig["routeRules"][] = [
      { "/build/private/**": { cors: false } },
      { "/build/*.js": { cors: { origin: ["https://nitro.build"] } } },
      { "GET /build/**": { cors: false } },
    ];
    for (const rules of cases) {
      const nitro = createNitro({ "/**": { cors: true }, ...rules });
      expect(getPublicAssetCorsHeaders(nitro)).toEqual([]);
      expect(nitro.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`\`${Object.keys(rules!)[0]}\``)
      );
    }
    const nitro = createNitro({ "/**": { cors: true }, "/build/fonts/**": { cors: true } });
    expect(getPublicAssetCorsHeaders(nitro)).toEqual([{ base: "/build", headers: CORS }]);
    expect(nitro.logger.warn).not.toHaveBeenCalled();
  });

  it("skips dirs where a rule sets a CORS header for some files only", () => {
    for (const key of ["/build/fonts/**", "GET /build/**"]) {
      const nitro = createNitro({
        "/**": { cors: true },
        [key]: { headers: { "access-control-allow-origin": "https://nitro.build" } },
      });
      expect(getPublicAssetCorsHeaders(nitro)).toEqual([]);
      expect(nitro.logger.warn).toHaveBeenCalledWith(expect.stringContaining(`\`${key}\``));
    }
    const nitro = createNitro({
      "/**": { cors: true },
      "/build/fonts/**": { headers: { "x-fonts": "1" } },
    });
    expect(getPublicAssetCorsHeaders(nitro)).toEqual([{ base: "/build", headers: CORS }]);
  });

  it("leaves headers set with `headers` to their rule", () => {
    expect(
      getPublicAssetCorsHeaders(
        createNitro({
          "/**": { cors: true },
          "/build/**": { headers: { "Access-Control-Allow-Origin": "https://nitro.build" } },
        })
      )
    ).toEqual([{ base: "/build", headers: { "access-control-expose-headers": "*" } }]);
  });

  it("leaves headers set in the user's `_headers` file to it", () => {
    const nitro = createNitro({ "/**": { cors: true } });
    const corsFor = (headersFile: string) => getPublicAssetCorsHeaders(nitro, { headersFile });
    expect(corsFor("/build/*\n  Access-Control-Allow-Origin: https://nitro.build\n")).toEqual([
      { base: "/build", headers: { "access-control-expose-headers": "*" } },
    ]);
    expect(corsFor("/*\n  ! Access-Control-Expose-Headers\n")).toEqual([
      { base: "/build", headers: { "access-control-allow-origin": "*" } },
    ]);
    expect(
      corsFor(
        "/api/*\n  access-control-allow-origin: https://nitro.build\n  # access-control-expose-headers: x\n"
      )
    ).toEqual([{ base: "/build", headers: CORS }]);
  });

  it("covers nested dirs and dirs with the same base once", () => {
    const nitro = createNitro({ "/**": { cors: true } }, [
      { baseURL: "/build/fonts" },
      { baseURL: "/build" },
      { dir: "other", baseURL: "/build" },
    ]);
    expect(getPublicAssetCorsHeaders(nitro)).toEqual([{ base: "/build", headers: CORS }]);
  });
});
