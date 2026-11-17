import { fileURLToPath } from "node:url";
import type { ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe("vite:renderer template fetch", () => {
  let server: ViteDevServer;
  let serverURL: string;

  beforeAll(async () => {
    const root = fileURLToPath(new URL("./renderer-fetch-fixture", import.meta.url));
    server = await createServer({ root, logLevel: "warn" });
    await server.listen("0" as unknown as number);
    const addr = server.httpServer?.address() as { port: number; address: string; family: string };
    serverURL = `http://${addr.family === "IPv6" ? `[${addr.address}]` : addr.address}:${addr.port}`;
  }, 30_000);

  afterAll(async () => {
    await server?.close();
  });

  test("does not render itself for a template fetch with no route", async () => {
    const res = await fetch(`${serverURL}/api/missing`, { headers: { accept: "text/html" } });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<pre>404</pre>");
  });
});
