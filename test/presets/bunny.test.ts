import { promises as fsp } from "node:fs";
import { RunnerManager } from "env-runner";
import { SelfEnvRunner } from "env-runner/runners/self";
import { resolve } from "pathe";
import { describe, expect, it } from "vitest";
import { setupTest, testNitro } from "../tests.ts";

describe("nitro:preset:bunny", async () => {
  const ctx = await setupTest("bunny-edge-scripting");

  testNitro(ctx, async () => {
    const wrapperPath = resolve(ctx.outDir, "bunny-edge-scripting.entry.mjs");
    await fsp.writeFile(
      wrapperPath,
      [
        "let _fetch;",
        "globalThis.Bunny = {",
        "  v1: { serve: (fn) => { _fetch = fn; } },",
        "  unstable: { waitUntil: (p) => p },",
        "};",
        'await import("./bunny-edge-scripting.mjs");',
        "export default { fetch: (req) => _fetch(req) };",
        "",
      ].join("\n")
    );

    const runner = new SelfEnvRunner({
      name: "bunny",
      data: { entry: wrapperPath },
    });
    const manager = new RunnerManager(runner);
    await runner.waitForReady(10_000);

    ctx.server = {
      url: "http://localhost",
      close: () => manager.close(),
    };

    return async ({ url, headers, method, body }) => {
      return await manager.fetch("http://localhost" + url, {
        headers: headers || {},
        method: method || "GET",
        redirect: "manual",
        body,
      });
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
    if (ctx.nitro?.options.serveStatic === "inline") {
      expect(serverFiles).not.toContain("public");
    } else {
      expect(serverFiles).toContain("public");
    }
  });

  it("should have minified output", async () => {
    const entry = await fsp.readFile(resolve(ctx.outDir, "bunny-edge-scripting.mjs"), "utf8");
    const newlineCount = (entry.match(/\n/g) || []).length;
    const ratio = entry.length / Math.max(1, newlineCount);
    expect(ratio).toBeGreaterThan(500);
  });

  it("should contain the Bunny.v1.serve call", async () => {
    const entry = await fsp.readFile(resolve(ctx.outDir, "bunny-edge-scripting.mjs"), "utf8");
    expect(entry).toContain("Bunny");
  });
});
