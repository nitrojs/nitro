import { existsSync, promises as fsp } from "node:fs";
import { resolve } from "pathe";
import { describe, it, expect } from "vitest";
import { isWindows } from "std-env";
import { startServer, setupTest, testNitro } from "../tests";

describe("nitro:preset:node", async () => {
  const ctx = await setupTest("node");

  testNitro(ctx, async () => {
    const entryPath = resolve(ctx.outDir, "server/index.mjs");
    const { listener } = await import(entryPath);

    await startServer(ctx, listener);

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

  it.skipIf(isWindows)("should not bundle externals", () => {
    const serverNodeModules = resolve(ctx.outDir, "server/node_modules");
    expect(
      existsSync(resolve(serverNodeModules, "@fixture/nitro-utils/extra.mjs"))
    ).toBe(true);
    expect(
      existsSync(resolve(serverNodeModules, "@fixture/nitro-utils/extra2.mjs"))
    ).toBe(true);
  });
});
