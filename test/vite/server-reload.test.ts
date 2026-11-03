import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import type { ViteDevServer } from "vite";
import { describe, test, expect, beforeAll, afterAll } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe("vite: `vite.serverReload` (nitro.config)", () => {
  let server: ViteDevServer;
  let serverURL: string;

  const rootDir = fileURLToPath(new URL("./server-reload-fixture", import.meta.url));
  const handlerFile = join(rootDir, "api/state.ts");
  const originalContent = readFileSync(handlerFile, "utf-8");

  beforeAll(async () => {
    process.chdir(rootDir);
    server = await createServer({ root: rootDir, logLevel: "warn" });
    await server.listen("0" as unknown as number);
    const addr = server.httpServer?.address() as { port: number; address: string; family: string };
    serverURL = `http://${addr.family === "IPv6" ? `[${addr.address}]` : addr.address}:${addr.port}`;
  }, 30_000);

  afterAll(async () => {
    writeFileSync(handlerFile, originalContent);
    await server?.close();
  });

  // `serverReload: false` has to suppress the reload of the dev worker, not
  // just nitro's own `full-reload`: Vite's default handling would otherwise
  // still send one for the same change.
  test("keeps the dev worker on the loaded modules", async () => {
    expect(await fetch(`${serverURL}/api/state`).then((r) => r.text())).toContain("original");

    writeFileSync(handlerFile, originalContent.replace("original", "modified"));

    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(await fetch(`${serverURL}/api/state`).then((r) => r.text())).toContain("original");
    }
  });

  test("does not ask open dev error pages to reload", async () => {
    const res = await fetch(`${serverURL}/api/broken`, {
      headers: { accept: "text/html", "sec-fetch-dest": "document" },
    });
    expect(res.status).toBe(500);
    expect(await res.text()).toContain("/_nitro/dev/reload");

    const reloadState = () => fetch(`${serverURL}/_nitro/dev/reload?id=none`).then((r) => r.json());
    const before = await reloadState();
    writeFileSync(handlerFile, originalContent.replace("original", "modified again"));
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(await reloadState()).toEqual(before);
  });
});
