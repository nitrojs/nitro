import { rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import type { ViteDevServer } from "vite";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

// Vite restarts in the same process (e.g. on `vite.config` changes), so files
// added since the previous start must be detected again.
describe("vite: restart detects files added after start", () => {
  let server: ViteDevServer;

  const rootDir = fileURLToPath(new URL("./restart-detect-fixture", import.meta.url));
  const indexFile = join(rootDir, "index.html");
  const serverFile = join(rootDir, "server.ts");

  const fetchPath = (path: string) => {
    const addr = server.httpServer?.address() as { port: number; address: string; family: string };
    const host = addr.family === "IPv6" ? `[${addr.address}]` : addr.address;
    return fetch(`http://${host}:${addr.port}${path}`, { headers: { accept: "text/html" } });
  };

  const removeFiles = () => {
    rmSync(indexFile, { force: true });
    rmSync(serverFile, { force: true });
  };

  beforeAll(async () => {
    removeFiles();
    server = await createServer({ root: rootDir, logLevel: "warn" });
    await server.listen("0" as unknown as number);
  }, 30_000);

  afterEach(async () => {
    removeFiles();
    await server.restart();
  }, 30_000);

  afterAll(async () => {
    removeFiles();
    await server?.close();
  });

  test("index.html as renderer template", async () => {
    expect((await fetchPath("/")).status).toBe(404);

    writeFileSync(indexFile, "<!doctype html><html><body>added after start</body></html>");
    await server.restart();

    const res = await fetchPath("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("added after start");
  }, 30_000);

  test("server.ts as server entry", async () => {
    expect((await fetchPath("/foo")).status).toBe(404);

    writeFileSync(serverFile, `export default { fetch: () => new Response("added after start") };`);
    await server.restart();

    const res = await fetchPath("/foo");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("added after start");
  }, 30_000);
});
