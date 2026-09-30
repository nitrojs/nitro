import { promises as fsp } from "node:fs";
import { RunnerManager } from "env-runner";
import { SelfEnvRunner } from "env-runner/runners/self";
import { resolve } from "pathe";
import { describe, expect, it } from "vitest";
import { builtinNodeModules } from "../../src/presets/bunny/unenv/node-compat.ts";
import { setupTest, testNitro } from "../tests.ts";

describe("nitro:preset:bunny", async () => {
  const ctx = await setupTest("bunny-edge-scripting");

  testNitro(ctx, async () => {
    const manager = await serveBundle(ctx.outDir);

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

  it("should keep the public directory when `serveStatic` is disabled", async () => {
    const serverFiles = await fsp.readdir(resolve(ctx.outDir));
    expect(ctx.nitro!.options.serveStatic).toBe(false);
    expect(serverFiles).toContain("public");
  });

  it("should not externalize dependencies", async () => {
    const serverFiles = await fsp.readdir(resolve(ctx.outDir));
    expect(serverFiles).not.toContain("node_modules");

    // Anything left as a bare specifier would be resolved from `node_modules`
    // at runtime, which Edge Scripting cannot do for a single-file script.
    // `npm:`/`jsr:` carry their own source and version, so they are allowed.
    const imports = await readImports(ctx.outDir);
    expect(imports.filter((id) => !/^(node:|https?:|npm:|jsr:|\.{0,2}\/)/.test(id))).toEqual([]);
  });

  it("should only import node builtins allowed by Bunny", async () => {
    // Importing anything outside Bunny's allow-list fails at deploy time with
    // `Unknown: disallowed module reference`.
    const imports = await readImports(ctx.outDir);
    const nodeImports = [...new Set(imports.filter((id) => id.startsWith("node:")))];
    expect(nodeImports.filter((id) => !builtinNodeModules.includes(id))).toEqual([]);
  });

  it("should not bundle the websocket adapter when the feature is off", async () => {
    const entry = await fsp.readFile(resolve(ctx.outDir, "bunny-edge-scripting.mjs"), "utf8");
    expect(entry).not.toContain("upgradeWebSocket");
  });

  it("should have minified output", async () => {
    const entry = await fsp.readFile(resolve(ctx.outDir, "bunny-edge-scripting.mjs"), "utf8");
    const newlineCount = (entry.match(/\n/g) || []).length;
    const ratio = entry.length / Math.max(1, newlineCount);
    expect(ratio).toBeGreaterThan(500);
  });

  it("should contain the Bunny.v1.serve call", async () => {
    const entry = await fsp.readFile(resolve(ctx.outDir, "bunny-edge-scripting.mjs"), "utf8");
    expect(entry).toContain("Bunny.v1.serve");
  });
});

// The shared preset tests above build with `serveStatic: false` (see `isWorker`
// in `test/tests.ts`), so the preset default is covered separately here.
describe("nitro:preset:bunny:inline", async () => {
  const ctx = await setupTest("bunny-edge-scripting", {
    outDirSuffix: "-inline",
    config: { serveStatic: "inline" },
  });

  const manager = await serveBundle(ctx.outDir);
  ctx.server = {
    url: "http://localhost",
    close: () => manager.close(),
  };

  it("should remove the public directory", async () => {
    const serverFiles = await fsp.readdir(resolve(ctx.outDir));
    expect(serverFiles).not.toContain("public");
  });

  it("should serve public assets from the bundle", async () => {
    const res = await manager.fetch("http://localhost/build/test.txt");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await res.text()).toBe("Works!\n");
  });
});

// Build-only: Bunny websockets are still blocked by an upstream PoP issue, so
// this only asserts the adapter is wired into the bundle.
describe("nitro:preset:bunny:websocket", async () => {
  const ctx = await setupTest("bunny-edge-scripting", {
    outDirSuffix: "-ws",
    config: {
      features: { websocket: true },
      handlers: [
        {
          route: "/_ws",
          handler: resolve(import.meta.dirname, "fixtures/websocket.ts"),
        },
      ],
    },
  });

  it("should bundle the crossws bunny adapter", async () => {
    const entry = await fsp.readFile(resolve(ctx.outDir, "bunny-edge-scripting.mjs"), "utf8");
    expect(entry).toContain("upgradeWebSocket");
  });
});

// Boots the built bundle under a stubbed `Bunny` global, the way Bunny Edge
// Scripting invokes it, and exposes a `fetch` into the running app.
async function serveBundle(outDir: string) {
  const wrapperPath = resolve(outDir, "bunny-edge-scripting.entry.mjs");
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

  return manager;
}

async function readImports(outDir: string) {
  const entry = await fsp.readFile(resolve(outDir, "bunny-edge-scripting.mjs"), "utf8");
  return [...entry.matchAll(/(?:^|[;}])import\s*(?:[^"';]*from\s*)?"([^"]+)"/g)].map((m) => m[1]!);
}
