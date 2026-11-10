import { fileURLToPath } from "node:url";
import type { ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

// #4994: Node resolves the imports of externalized dependencies without the `development`
// condition, so Vite must not resolve the app's own imports of them with it either.
describe("vite: external conditions in dev", { concurrent: false }, () => {
  let server: ViteDevServer;
  let serverURL: string;

  const rootDir = fileURLToPath(new URL("./external-conditions-fixture", import.meta.url));
  const originalCwd = process.cwd();

  beforeAll(async () => {
    process.chdir(rootDir);
    server = await createServer({ root: rootDir, logLevel: "warn" });
    await server.listen("0" as unknown as number);
    const addr = server.httpServer?.address() as { port: number; address: string; family: string };
    serverURL = `http://${addr.family === "IPv6" ? `[${addr.address}]` : addr.address}:${addr.port}`;
  }, 30_000);

  afterAll(async () => {
    await server?.close();
    process.chdir(originalCwd);
  });

  test("loads a single copy of an externalized dependency", async () => {
    const res = await fetch(serverURL);
    expect(await res.json()).toEqual({ app: "default", consumer: "default" });
  }, 30_000);
});
