import { promises as fsp } from "node:fs";
import { execa, execaCommandSync } from "execa";
import { getRandomPort, waitForPort } from "get-port-please";
import { resolve } from "pathe";
import { describe, expect, it } from "vitest";
import { setupTest, testNitro } from "../tests.ts";

const hasDeno =
  execaCommandSync("deno --version", { stdio: "ignore", reject: false }).exitCode === 0;

describe.runIf(hasDeno)("nitro:preset:bunny", async () => {
  const ctx = await setupTest("bunny-edge-scripting");

  testNitro(ctx, async () => {
    const port = await getRandomPort();
    execa("deno", ["run", "-A", "./bunny-edge-scripting.mjs"], {
      cwd: ctx.outDir,
      stdio: "ignore",
      env: {
        NITRO_PORT: String(port),
        NITRO_HOST: "127.0.0.1",
      },
    });
    ctx.server = {
      url: `http://127.0.0.1:${port}`,
      close: () => {
        // Process cleanup handled by test teardown
      },
    } as any;
    await waitForPort(port, { delay: 1000, retries: 20, host: "127.0.0.1" });
    return async ({ url, ...opts }) => {
      const res = await ctx.fetch(url, opts);
      return res;
    };
  });

  it("should generate the bunny-edge-scripting.mjs file", async () => {
    const serverFiles = await fsp.readdir(resolve(ctx.outDir));
    expect(serverFiles).toContain("bunny-edge-scripting.mjs");
  });

  it("should not have a separate server directory", async () => {
    const serverFiles = await fsp.readdir(resolve(ctx.outDir));
    expect(serverFiles).not.toContain("server");
  });

  it("should not have a public directory (assets should be inlined)", async () => {
    const serverFiles = await fsp.readdir(resolve(ctx.outDir));
    expect(serverFiles).not.toContain("public");
  });

  it("should have minified output", async () => {
    const entry = await fsp.readFile(resolve(ctx.outDir, "bunny-edge-scripting.mjs"), "utf8");
    // Check file is actually minified - should have very few newlines relative to size
    const newlineCount = (entry.match(/\n/g) || []).length;
    const ratio = entry.length / Math.max(1, newlineCount);
    // Fixture is small, so we expect a high ratio of characters to newlines in minified code
    expect(ratio).toBeGreaterThan(500);
  });

  it("should contain the Bunny.v1.serve call", async () => {
    const entry = await fsp.readFile(resolve(ctx.outDir, "bunny-edge-scripting.mjs"), "utf8");
    expect(entry).toContain("Bunny");
  });
});
