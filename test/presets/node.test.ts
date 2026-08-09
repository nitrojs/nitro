import { existsSync } from "node:fs";
import { resolve } from "pathe";
import { isWindows } from "std-env";
import { execa } from "execa";
import { getRandomPort, waitForPort } from "get-port-please";
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

describe("nitro:preset:node-server", async () => {
  const ctx = await setupTest("node-server");

  it.skipIf(isWindows)(
    "calls the `close` hook on shutdown",
    async () => {
      const port = await getRandomPort();
      const entryPath = resolve(ctx.outDir, "server/index.mjs");
      // srvx graceful shutdown is disabled when the CI/TEST env vars are set
      const env: Record<string, string | undefined> = {
        ...process.env,
        NITRO_PORT: String(port),
        NITRO_HOST: "127.0.0.1",
        NITRO_TEST_CLOSE_HOOK: "true",
      };
      delete env.CI;
      delete env.TEST;
      const child = execa(process.execPath, [entryPath], { env, extendEnv: false, reject: false });

      let output = "";
      child.stdout!.on("data", (data) => (output += data));
      child.stderr!.on("data", (data) => (output += data));

      await waitForPort(port, { delay: 1000, retries: 20, host: "127.0.0.1" });

      child.kill("SIGTERM");
      // Wait for the close hook marker or process exit (the fixture task scheduler
      // can keep the event loop alive after the server closed)
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 10_000);
        child.on("close", () => {
          clearTimeout(timeout);
          resolve();
        });
        child.stdout!.on("data", (data) => {
          if (String(data).includes("[fixture] close hook called")) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
      child.kill("SIGKILL");

      expect(output).toContain("[fixture] close hook called");
      expect(output).not.toContain("unhandledRejection");
    },
    40_000
  );
});
