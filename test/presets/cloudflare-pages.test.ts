import { promises as fsp } from "node:fs";
import { Miniflare } from "miniflare";
import { resolve } from "pathe";
import { describe, expect, it } from "vitest";

import { isWindows } from "std-env";
import { setupTest, testNitro } from "../tests.ts";

describe.skipIf(isWindows)("nitro:preset:cloudflare-pages", async () => {
  const ctx = await setupTest("cloudflare-pages");

  testNitro(ctx, () => {
    const mf = new Miniflare({
      modules: true,
      compatibilityDate: "2025-04-01",
      scriptPath: resolve(ctx.outDir, "_worker.js", "index.js"),
      modulesRules: [{ type: "CompiledWasm", include: ["**/*.wasm"] }],
      compatibilityFlags: ["nodejs_compat", "no_nodejs_compat_v2"],
      sitePath: "",
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

  it("should generate a _routes.json", async () => {
    const config = await fsp
      .readFile(resolve(ctx.outDir, "_routes.json"), "utf8")
      .then((r) => JSON.parse(r));
    expect(config).toMatchInlineSnapshot(`
      {
        "exclude": [
          "/blog/static/*",
          "/cf-pages-exclude/*",
          "/build/*",
          "/_openapi.json",
          "/_openapi.json.br",
          "/_openapi.json.gz",
          "/_openapi.json.zst",
          "/_scalar",
          "/_swagger",
          "/favicon.ico",
          "/foo.css",
          "/foo.js",
          "/json-string",
          "/nitro.json.br",
          "/nitro.json.gz",
          "/nitro.json.zst",
          "/prerender",
          "/prerender-custom",
          "/_scalar/index.html.br",
          "/_scalar/index.html.gz",
          "/_scalar/index.html.zst",
          "/_swagger/index.html.br",
          "/_swagger/index.html.gz",
          "/_swagger/index.html.zst",
          "/api/hello",
          "/api/hey",
          "/prerender/index.html.br",
          "/prerender/index.html.gz",
          "/prerender/index.html.zst",
          "/api/param/foo.json",
          "/api/param/hidden",
          "/api/param/prerender1",
          "/api/param/prerender3",
          "/api/param/prerender4",
        ],
        "include": [
          "/*",
        ],
        "version": 1,
      }
    `);
  });

  it("does not let the browser cache a missing public asset", async () => {
    const mf = new Miniflare({
      modules: true,
      compatibilityDate: "2025-04-01",
      scriptPath: resolve(ctx.outDir, "_worker.js", "index.js"),
      modulesRules: [{ type: "CompiledWasm", include: ["**/*.wasm"] }],
      compatibilityFlags: ["nodejs_compat", "no_nodejs_compat_v2"],
      // The `_headers` rule of a public assets base also applies to a missing file
      serviceBindings: {
        ASSETS: () =>
          new Response("Not Found", {
            status: 404,
            headers: { "cache-control": "public, max-age=3600, immutable" },
          }),
      },
      bindings: { ...ctx.env },
    });
    try {
      const missing = await mf.dispatchFetch("http://localhost/build/missing.js");
      expect(missing.status).toBe(404);
      expect(missing.headers.get("cache-control")).toBe("no-store");
    } finally {
      await mf.dispose();
    }
  });

  it("should export the correct functions", async () => {
    const entry = await fsp.readFile(resolve(ctx.outDir, "_worker.js", "index.js"), "utf8");
    expect(entry).toMatch(/export \{[^}]*myScheduled[^}]*\}/);
  });
});
