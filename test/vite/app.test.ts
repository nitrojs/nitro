import { fileURLToPath } from "node:url";
import type { ViteDevServer } from "vite";
import { describe, test, expect, beforeAll, afterAll } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe("vite:app", () => {
  let server: ViteDevServer;
  let serverURL: string;

  const rootDir = fileURLToPath(new URL("./app-fixture", import.meta.url));

  const originalCwd = process.cwd();

  beforeAll(async () => {
    process.chdir(rootDir);
    server = await createServer({ root: rootDir });
    await server.listen("0" as unknown as number);
    const addr = server.httpServer?.address() as {
      port: number;
      address: string;
      family: string;
    };
    serverURL = `http://${addr.family === "IPv6" ? `[${addr.address}]` : addr.address}:${addr.port}`;
  }, 30_000);

  afterAll(async () => {
    await server?.close();
    process.chdir(originalCwd);
  });

  test("SSR entry can use nitro/storage (shared with nitro env)", async () => {
    const res = await fetch(serverURL);
    const data = (await res.json()) as { storage: string; config: string };
    expect(data.storage).toBe("value-from-ssr");
  });

  test("SSR entry can use nitro/runtime-config", async () => {
    const res = await fetch(serverURL);
    const data = (await res.json()) as { storage: string; config: string };
    expect(data.config).toBe("NITRO_");
  });

  test("storage is shared between SSR and nitro environments", async () => {
    // SSR entry writes to storage, API route reads it
    await fetch(serverURL);
    const res = await fetch(`${serverURL}/api/storage`);
    const value = await res.text();
    expect(value).toBe("value-from-ssr");
  });
});
