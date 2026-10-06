import { createServer as createHTTPServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { joinURL } from "ufo";
import type { ViteDevServer } from "vite";
import { beforeAll, afterAll, describe, expect, test } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe.each(["/", "/app/"])("vite:dev handlers under base (baseURL: %s)", (baseURL) => {
  let server: ViteDevServer;
  let serverURL: string;
  let upstream: Server;

  const rootDir = fileURLToPath(new URL("./base-dev-handlers-fixture", import.meta.url));
  const originalCwd = process.cwd();
  const url = (path: string) => joinURL(baseURL, path);

  beforeAll(async () => {
    upstream = createHTTPServer((req, res) => res.end(`upstream:${req.url}`));
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    process.env.NITRO_TEST_UPSTREAM = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
    process.env.NITRO_TEST_BASE_URL = baseURL;
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
    upstream?.close();
    delete process.env.NITRO_TEST_UPSTREAM;
    delete process.env.NITRO_TEST_BASE_URL;
    process.chdir(originalCwd);
  });

  test("routes asset-like requests to a dev handler", async () => {
    for (const [path, fetchDest] of [
      [url("/_assets/probe/a.woff2"), undefined],
      [url("/_assets/probe/a"), "font"],
      [url("/_probe/b.woff2"), undefined],
    ]) {
      const headers: Record<string, string> = { accept: "*/*" };
      if (fetchDest) {
        headers["sec-fetch-dest"] = fetchDest;
      }
      const response = await fetch(`${serverURL}${path}`, { headers, redirect: "manual" });
      const label = `${path} (sec-fetch-dest: ${fetchDest})`;
      expect(response.status, label).toBe(200);
      expect(await response.text(), label).toBe(`probe:${path}`);
    }
  });

  test("routes asset-like requests to a dev proxy", async () => {
    const path = url("/_assets/upstream/a.woff2");
    const response = await fetch(`${serverURL}${path}`, {
      headers: { "sec-fetch-dest": "font" },
      redirect: "manual",
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(`upstream:${path}`);
  });

  test("keeps a dev handler 404 for asset-like requests", async () => {
    const response = await fetch(`${serverURL}${url("/_assets/missing/a.woff2")}`, {
      headers: { "sec-fetch-dest": "font" },
      redirect: "manual",
    });
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("missing");
  });

  test("routes asset-like requests to a public asset dir without fallthrough", async () => {
    const response = await fetch(`${serverURL}${url("/pub/x.txt")}`, {
      headers: { "sec-fetch-dest": "image" },
      redirect: "manual",
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("pub-asset");
  });

  test("keeps a public asset dir 404 for missing assets", async () => {
    const response = await fetch(`${serverURL}${url("/pub/missing.txt")}`, {
      headers: { "sec-fetch-dest": "image" },
      redirect: "manual",
    });
    expect(response.status).toBe(404);
    expect(await response.text()).not.toMatch(/public base URL/);
  });

  test("does not route Vite assets to a catch-all dev handler", async () => {
    const response = await fetch(`${serverURL}${url("/_assets/client.ts")}`, {
      headers: { "sec-fetch-dest": "script" },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/javascript/);
  });
});
