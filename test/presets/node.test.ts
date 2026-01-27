import { existsSync } from "node:fs";
import { resolve } from "pathe";
// import { isWindows } from "std-env";
import { describe, expect, it } from "vitest";
import { setupTest, startServer, testNitro } from "../tests.ts";

describe("nitro:preset:node-middleware", async () => {
  const ctx = await setupTest("node-middleware");

  testNitro(ctx, async () => {
    const entryPath = resolve(ctx.outDir, "server/index.mjs");
    const { middleware } = await import(entryPath);

    await startServer(ctx, middleware);

    return async ({ url, ...opts }) => {
      const res = await ctx.fetch(url, opts);
      return res;
    };
  });

  it("should handle nested cached route rules", async () => {
    const cached = await ctx.fetch("/rules/_/noncached/cached");
    expect(cached.headers.get("etag")).toBeDefined();

    const noncached = await ctx.fetch("/rules/_/noncached/noncached");
    expect(noncached.headers.get("etag")).toBeNull();

    const cached2 = await ctx.fetch("/rules/_/cached/cached");
    expect(cached2.headers.get("etag")).toBeDefined();

    const noncached2 = await ctx.fetch("/rules/_/cached/noncached");
    expect(noncached2.headers.get("etag")).toBeNull();
  });

  it("should trace externals", () => {
    const serverNodeModules = resolve(ctx.outDir, "server/node_modules");
    expect(existsSync(resolve(serverNodeModules, "@fixture/nitro-utils/extra.mjs"))).toBe(true);
  });
});
