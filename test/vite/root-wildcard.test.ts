import { fileURLToPath } from "node:url";
import type { ViteDevServer } from "vite";
import { beforeAll, afterAll, describe, expect, test } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe("vite:root wildcard routes", { sequential: true }, () => {
  let server: ViteDevServer;
  let serverURL: string;

  const rootDir = fileURLToPath(new URL("./root-wildcard-fixture", import.meta.url));
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

  // #4234/#4266: a root-level user catch-all (`routes/[...path].ts` -> `/**:path`) is as
  // authoritative as the SSR `/**` renderer — it must not swallow Vite's own asset serves
  // (`<script src=".../entry-client.ts">`), so the asset heuristic still applies to it.
  test("root-level named catch-all does not swallow Vite asset loads", async () => {
    for (const fetchDest of ["script", "style", "image", undefined]) {
      const headers: Record<string, string> = { accept: "*/*" };
      if (fetchDest) {
        headers["sec-fetch-dest"] = fetchDest;
      }
      const response = await fetch(`${serverURL}/entry-client.ts`, {
        headers,
        redirect: "manual",
      });
      // The catch-all would answer 200 (`root-wildcard:...`); Vite 404s a missing asset.
      expect(response.status, `sec-fetch-dest: ${fetchDest}`).not.toBe(200);
    }
  });

  // A non-asset page navigation must still reach the root catch-all handler.
  test("root-level named catch-all handles page navigations", async () => {
    const headerVariants: Record<string, string>[] = [
      {},
      { "sec-fetch-dest": "document", accept: "text/html" },
    ];
    for (const headers of headerVariants) {
      const response = await fetch(`${serverURL}/some/nested/page`, {
        headers,
        redirect: "manual",
      });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("root-wildcard:some/nested/page");
    }
  });
});
