import { fileURLToPath } from "node:url";
import type { ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

// #4923: the srvx tracing channels must be emitted by the Vite dev server too, not only by the
// production server.
describe("vite: tracing channels in dev", { concurrent: false }, () => {
  let server: ViteDevServer;
  let serverURL: string;

  const rootDir = fileURLToPath(new URL("./tracing-channel-fixture", import.meta.url));
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

  test("emits srvx and h3 request tracing channels", async () => {
    // The first request evaluates the app (and subscribes the probe plugin).
    await fetch(`${serverURL}/api/probe`);
    const counts = (await (await fetch(`${serverURL}/api/probe`)).json()) as Record<string, number>;
    expect(counts["h3.request"]).toBeGreaterThan(0);
    expect(counts["srvx.request"]).toBeGreaterThan(0);
  }, 30_000);
});
