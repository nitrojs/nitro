import { Miniflare } from "miniflare";
import { resolve } from "pathe";
import { Response as _Response } from "undici";
import { describe, expect, it } from "vitest";

import { setupTest, testNitro } from "../tests";
import { promises as fsp } from "node:fs";

describe("nitro:preset:cloudflare-module", async () => {
  const ctx = await setupTest("cloudflare-module", {
    config: {
      routeRules: {
        "/": {
          headers: {
            "x-test": "test",
            "x-cf-test-root": "test",
          },
        },
        "/cf/_header/**": {
          headers: {
            "x-cf-test": "0",
          },
        },
        "/cf/_header/0": {
          headers: {
            "x-cf-test": "0",
          },
        },
        "/cf/_header/a": {
          headers: {
            "x-cf-test": "a",
          },
        },
        "/cf/_header/B": {
          headers: {
            "X-CF-Test": "0",
          },
        },
        "/cf/_header/1/**": {
          headers: {
            "x-cf-test": "1",
          },
        },
        "/cf/_header/1/2/**": {
          headers: {
            "x-cf-test": "2",
          },
        },
        "/cf/_header/1/2/1": {
          headers: {
            "x-cf-test": "1",
          },
        },
        "/cf/_header/1/2/2": {
          headers: {
            "x-cf-test": "2",
          },
        },
        "/cf/_header/2/2/0": {
          headers: {
            "x-cf-test": "0",
          },
        },
      },
    },
  });

  testNitro(ctx, () => {
    const mf = new Miniflare({
      modules: true,
      scriptPath: resolve(ctx.outDir, "server/index.mjs"),
      modulesRules: [{ type: "CompiledWasm", include: ["**/*.wasm"] }],
      assets: {
        directory: resolve(ctx.outDir, "public"),
        routerConfig: { has_user_worker: true },
        assetConfig: {
          // https://developers.cloudflare.com/workers/static-assets/routing/#routing-configuration
          html_handling: "auto-trailing-slash" /* default */,
          not_found_handling: "none" /* default */,
        },
      },
      compatibilityFlags: [
        "streams_enable_constructors",
        "nodejs_compat",
        "no_nodejs_compat_v2",
      ],
      bindings: { ...ctx.env },
    });

    return async ({ url, headers, method, body }) => {
      const res = await mf.dispatchFetch("http://localhost" + url, {
        headers: headers || {},
        method: method || "GET",
        redirect: "manual",
        body,
      });
      return res as unknown as Response;
    };
  });

  it("should generate a _headers file", async () => {
    const config = await fsp.readFile(
      resolve(
        ctx.nitro?.options.output.publicDir || ctx.outDir + "/public",
        "_headers"
      ),
      "utf8"
    );
    expect(config).toMatchInlineSnapshot(`
      "/*
        x-test: test
      /
        x-cf-test-root: test
      /build/*
        cache-control: public, max-age=3600, immutable
        x-build-header: works
      /cf/_header/*
        x-cf-test: 0
      /cf/_header/1/*
        ! x-cf-test
        x-cf-test: 1
      /cf/_header/1/2/*
        ! x-cf-test
        x-cf-test: 2
      /cf/_header/1/2/1
        ! x-cf-test
        x-cf-test: 1
      /cf/_header/a
        ! x-cf-test
        x-cf-test: a
      /rules/cors
        access-control-allow-origin: *
        access-control-allow-methods: GET
        access-control-allow-headers: *
        access-control-max-age: 0
      /rules/headers
        cache-control: s-maxage=60"
    `);
  });
});
