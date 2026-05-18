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

  // #4234: a request matching only the SSR `/**` catch-all (no explicit route) that looks like
  // an asset must be handled by Vite, not swallowed by the catch-all renderer.
  test("does not let the SSR catch-all swallow asset-tagged requests", async () => {
    const res = await fetch(`${serverURL}/missing-asset.css`, {
      headers: { "sec-fetch-dest": "style" },
      redirect: "manual",
    });
    // The SSR renderer would answer 200 with JSON; Vite 404s a missing asset.
    expect(res.status).not.toBe(200);
  });

  // #4234: with `Sec-Fetch-*` absent (plain-HTTP non-loopback origins), a known asset extension
  // is the only signal — such a catch-all-only request must still reach Vite, not the renderer.
  test("does not let the SSR catch-all swallow asset loads when sec-fetch-dest is absent", async () => {
    const res = await fetch(`${serverURL}/missing-asset.js`, {
      headers: { accept: "*/*" },
      redirect: "manual",
    });
    expect(res.status).not.toBe(200);
  });

  // `Sec-Fetch-Dest: empty` (fetch/XHR) is ambiguous: a `fetch()`ed asset matching only the SSR
  // `/**` catch-all must reach Vite via the extension heuristic, not be swallowed by the renderer.
  test("does not let the SSR catch-all swallow fetch()ed assets (sec-fetch-dest: empty)", async () => {
    const res = await fetch(`${serverURL}/missing-asset.css`, {
      headers: { "sec-fetch-dest": "empty" },
      redirect: "manual",
    });
    expect(res.status).not.toBe(200);
  });

  // A page navigation matching only the SSR `/**` catch-all must reach the renderer.
  test("routes page navigations to the SSR catch-all renderer", async () => {
    const res = await fetch(`${serverURL}/some/nested/page`, {
      headers: { "sec-fetch-dest": "document", accept: "text/html" },
      redirect: "manual",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { config: string };
    expect(data.config).toBe("NITRO_");
  });
});
