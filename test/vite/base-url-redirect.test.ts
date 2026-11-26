import { fileURLToPath } from "node:url";
import type { ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe("vite:baseURL redirect", () => {
  let server: ViteDevServer;
  let serverURL: string;

  beforeAll(async () => {
    const root = fileURLToPath(new URL("./base-url-redirect-fixture", import.meta.url));
    server = await createServer({ root, logLevel: "warn" });
    await server.listen("0" as unknown as number);
    const addr = server.httpServer?.address() as { port: number; address: string; family: string };
    serverURL = `http://${addr.family === "IPv6" ? `[${addr.address}]` : addr.address}:${addr.port}`;
  }, 30_000);

  afterAll(async () => {
    await server?.close();
  });

  test("redirects the base path without a trailing slash to the base", async () => {
    for (const [path, location] of [
      ["/app", "/app/"],
      ["/app?x=1", "/app/?x=1"],
    ]) {
      const res = await fetch(`${serverURL}${path}`, { redirect: "manual" });
      expect(res.status, path).toBe(302);
      expect(res.headers.get("location"), path).toBe(location);
    }
  });
});
