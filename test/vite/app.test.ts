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
    // The SSR renderer would answer 200 with an HTML page; Vite 404s a missing asset.
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

  // #4433: Vite marks module-graph fetches for files it has to serve as modules with an `?import`
  // query. The marker only ever comes from the module graph, never from a page navigation, so such
  // a request must reach Vite even when the extension is not a known asset type (`.json`) and
  // `Sec-Fetch-Dest` is absent.
  test("does not let the SSR catch-all swallow ?import module requests", async () => {
    const res = await fetch(`${serverURL}/missing-module.json?import`, {
      headers: { accept: "*/*" },
      redirect: "manual",
    });
    expect(res.status).not.toBe(200);
  });

  // #4252: an asset-tagged request the SSR catch-all deliberately serves (non-page content-type)
  // must reach the renderer and pass through, even though the URL looks like an asset.
  test("SSR catch-all can serve asset-tagged requests", async () => {
    for (const headers of [
      { "sec-fetch-dest": "image", accept: "image/*" },
      { accept: "*/*" },
    ] as Record<string, string>[]) {
      const res = await fetch(`${serverURL}/dynamic-asset.png`, {
        headers,
        redirect: "manual",
      });
      expect(res.status, JSON.stringify(headers)).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(await res.text()).toBe("PNGDATA");
    }
  });

  // TanStack/router#7403 / #4274: JSON API routes served by the opaque SSR catch-all
  // (`<img src="/api/.../thumbnail">`) must pass through even when tagged as asset loads —
  // `application/json` is a deliberate serve, not a swallow.
  test("SSR catch-all can serve JSON API routes under asset sec-fetch-dest", async () => {
    for (const path of [
      "/api-json/thumbnail",
      "/api-json/foo.png",
      "/api-json/files?filename=something.png",
    ]) {
      const res = await fetch(`${serverURL}${path}`, {
        headers: { "sec-fetch-dest": "image", accept: "image/*" },
        redirect: "manual",
      });
      expect(res.status, path).toBe(200);
      expect(res.headers.get("content-type"), path).toContain("application/json");
    }
  });

  // HTTPError thrown from the SSR entry must propagate to the nitro app so the h3
  // error handler preserves its status and headers (consistent with production).
  test("propagates HTTPError status and headers from the SSR entry", async () => {
    const res = await fetch(`${serverURL}/?error`, {
      headers: { "sec-fetch-dest": "document", accept: "text/html" },
      redirect: "manual",
    });
    expect(res.status).toBe(418);
    expect(res.headers.get("x-test")).toBe("123");
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
