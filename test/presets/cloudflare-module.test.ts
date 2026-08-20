import { promises as fsp } from "node:fs";
import { Miniflare } from "miniflare";
import { resolve } from "pathe";
import { describe, expect, it } from "vitest";

import { setupTest, testNitro } from "../tests.ts";

describe("nitro:preset:cloudflare-module", async () => {
  const ctx = await setupTest("cloudflare-module");

  testNitro(
    ctx,
    () => {
      const mf = new Miniflare({
        modules: true,
        compatibilityDate: "2025-04-01",
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
        compatibilityFlags: ["nodejs_compat", "no_nodejs_compat_v2"],
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
    },
    (_ctx, callHandler) => {
      it("serves embedded string/template data without rewriting it", async () => {
        const { data, status } = await callHandler({ url: "/embedded-kit" });
        expect(status).toBe(200);
        expect(data.keys).toEqual(["h3.mjs"]);
        expect(data.source).toContain('import "node:fs";');
        expect(data.source).toContain("nitro4526marker");
      });
    }
  );

  it("should export the correct functions", async () => {
    const entry = await fsp.readFile(resolve(ctx.outDir, "server", "index.mjs"), "utf8");
    expect(entry).toMatch(/export \{.*myScheduled.*\}/);
  });

  it("should auto-generate cron triggers in wrangler.json", async () => {
    const wranglerConfig = await fsp
      .readFile(resolve(ctx.outDir, "server", "wrangler.json"), "utf8")
      .then((r) => JSON.parse(r));
    expect(wranglerConfig.triggers).toEqual({
      crons: ["* * * * *"],
    });
  });

  it("does not rewrite createRequire or strip node imports inside string/template data", async () => {
    const serverDir = resolve(ctx.outDir, "server");
    const files = await fsp.readdir(serverDir, { recursive: true });
    const code = (
      await Promise.all(
        files
          .filter((f) => typeof f === "string" && f.endsWith(".mjs"))
          .map((f) => fsp.readFile(resolve(serverDir, f), "utf8"))
      )
    ).join("\n");
    expect(code).toContain("const _require = createRequire(import.meta.url);");
    expect(code).toContain('import "node:fs";');
    expect(code).toContain("nitro4526marker");
  });
});
