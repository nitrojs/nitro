import { existsSync } from "node:fs";
import { execa } from "execa";
import { getRandomPort, waitForPort } from "get-port-please";
import { resolve } from "pathe";
// import { isWindows } from "std-env";
import { describe, expect, it } from "vitest";
import { setupTest, startServer, testNitro } from "../tests.ts";
import { testCloseHook } from "./_close-hook.ts";

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
    // required from a bundled CommonJS package (https://github.com/nitrojs/nitro/issues/4093)
    expect(existsSync(resolve(serverNodeModules, "@fixture/nitro-native-mock/index.js"))).toBe(
      true
    );
  });
});

describe("nitro:preset:node-server", async () => {
  const ctx = await setupTest("node-server");

  it("passes server entry options to srvx", async () => {
    const port = await getRandomPort();
    const child = execa(process.execPath, [resolve(ctx.outDir, "server/index.mjs")], {
      env: { NITRO_PORT: String(port), NITRO_HOST: "127.0.0.1" },
      stdio: process.env.TEST_DEBUG ? "inherit" : "ignore",
      reject: false,
    });
    try {
      await waitForPort(port, { delay: 1000, retries: 20, host: "127.0.0.1" });
      const res = await fetch(`http://127.0.0.1:${port}/srvx-middleware`);
      expect(await res.text()).toBe("server entry middleware works!");
      expect(res.headers.get("x-srvx-plugin")).toBe("works");
      const appFetch = await fetch(`http://127.0.0.1:${port}/api/app-fetch`);
      expect(await appFetch.json()).toEqual({
        body: "server entry middleware works!",
        plugin: "works",
        pluginRuns: 1,
      });
      const large = await fetch(`http://127.0.0.1:${port}/api/body-size`, {
        method: "POST",
        body: "x".repeat(128 * 1024),
      });
      expect(large.status).toBe(413);
    } finally {
      child.kill("SIGKILL");
    }
  }, 40_000);

  testCloseHook(ctx, { command: process.execPath, args: (entry) => [entry] });
});

describe("nitro:preset:node-cluster", async () => {
  const ctx = await setupTest("node-cluster");

  // `index.mjs` only forks workers (signals sent to it are not forwarded), so the
  // worker entry -- the one holding the server -- is spawned directly.
  testCloseHook(ctx, {
    command: process.execPath,
    args: (entry) => [resolve(entry, "../worker.mjs")],
  });
});
