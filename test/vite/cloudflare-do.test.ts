import { fileURLToPath } from "node:url";
import type { ViteDevServer } from "vite";
import { isWindows } from "std-env";
import { beforeAll, afterAll, describe, expect, test } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

// Durable Objects in `nitro dev` with the cloudflare preset (miniflare runner):
// DO classes from `exports.cloudflare.ts` are composed into the dev worker as
// static exports, and bindings (`env`) are forwarded to the hosted app.
describe.skipIf(isWindows)("vite:cloudflare-do", { sequential: true }, () => {
  let server: ViteDevServer;
  let serverURL: string;

  const rootDir = fileURLToPath(new URL("./cloudflare-do-fixture", import.meta.url));

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

  test("calls a Durable Object in dev (workerd)", async () => {
    const res = await fetch(`${serverURL}/counter`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { count: number };
    expect(data.count).toBe(1);
  });

  test("durable object state persists across requests", async () => {
    const res = await fetch(`${serverURL}/counter`);
    const data = (await res.json()) as { count: number };
    expect(data.count).toBe(2);
  });

  test("bindings are exposed via globalThis.__env__", async () => {
    const res = await fetch(`${serverURL}/counter`);
    const data = (await res.json()) as { hasGlobalEnv: boolean };
    expect(data.hasGlobalEnv).toBe(true);
  });

  test("workflow class is exported and bound", async () => {
    const res = await fetch(`${serverURL}/counter`);
    const data = (await res.json()) as { hasWorkflowBinding: boolean };
    expect(data.hasWorkflowBinding).toBe(true);
  });
});
