import { fileURLToPath } from "node:url";
import type { ViteDevServer } from "vite";
import { beforeAll, afterAll, describe, expect, test } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe("vite:config catch-all route", { concurrent: false }, () => {
  let server: ViteDevServer;
  let serverURL: string;

  const rootDir = fileURLToPath(new URL("./config-catchall-fixture", import.meta.url));
  const originalCwd = process.cwd();

  beforeAll(async () => {
    process.chdir(rootDir);
    server = await createServer({ root: rootDir, logLevel: "warn" });
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

  // #4531: a `/**` catch-all registered via `routes:` config is opaque like `serverEntry`, so an
  // asset-tagged request Vite cannot serve must still be dispatched to it.
  test("serves asset-tagged requests Vite cannot serve", async () => {
    for (const fetchDest of ["image", undefined]) {
      const headers: Record<string, string> = { accept: "*/*" };
      if (fetchDest) {
        headers["sec-fetch-dest"] = fetchDest;
      }
      const response = await fetch(`${serverURL}/generated.png`, { headers });
      expect(response.status, `sec-fetch-dest: ${fetchDest}`).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      expect(await response.text()).toBe("png:/generated.png");
    }
  });

  // An HTML page answering a missing asset is still treated as a miss (#4234).
  test("does not swallow missing assets with an HTML response", async () => {
    const response = await fetch(`${serverURL}/missing.js`, {
      headers: { accept: "*/*", "sec-fetch-dest": "script" },
    });
    expect(response.status).not.toBe(200);
  });

  test("handles page navigations", async () => {
    const response = await fetch(`${serverURL}/some/page`, {
      headers: { accept: "text/html", "sec-fetch-dest": "document" },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<p>catchall:/some/page</p>");
  });
});
