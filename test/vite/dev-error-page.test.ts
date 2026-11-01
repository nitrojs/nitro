import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createHTTPServer } from "node:http";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import type { ViteDevServer } from "vite";
import { describe, test, expect, beforeAll, afterAll } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe("vite: dev error page recovery", { concurrent: false }, () => {
  let server: ViteDevServer;
  let serverURL: string;

  const rootDir = fileURLToPath(new URL("./dev-error-page-fixture", import.meta.url));
  const stateFile = join(rootDir, "state.ts");
  const originalState = readFileSync(stateFile, "utf-8");
  const notesFile = join(rootDir, "notes.txt");

  const fetchPage = (init: { accept?: string; method?: string; dest?: string } = {}) =>
    fetch(serverURL, {
      method: init.method || "GET",
      headers: { accept: init.accept || "text/html", "sec-fetch-dest": init.dest || "document" },
    });

  const reloadState = async (query = "id=none") =>
    (await fetch(`${serverURL}/_nitro/dev/reload?${query}`)).json() as Promise<{
      id: string;
      v: number;
    }>;

  beforeAll(async () => {
    writeFileSync(notesFile, "");
    process.chdir(rootDir);
    server = await createServer({ root: rootDir, logLevel: "warn" });
    await server.listen("0" as unknown as number);
    const addr = server.httpServer?.address() as { port: number; address: string; family: string };
    serverURL = `http://${addr.family === "IPv6" ? `[${addr.address}]` : addr.address}:${addr.port}`;
  }, 30_000);

  afterAll(async () => {
    writeFileSync(stateFile, originalState);
    rmSync(notesFile, { force: true });
    await server?.close();
  });

  test("leaves non-HTML and non-GET error responses untouched", async () => {
    const json = await fetchPage({ accept: "application/json" });
    expect(json.status).toBe(500);
    expect(await json.text()).not.toContain("/_nitro/dev/reload");

    const post = await fetchPage({ method: "POST" });
    expect(post.status).toBe(500);
    expect(await post.text()).not.toContain("/_nitro/dev/reload");
  });

  test("does not inject into fetch() requests", async () => {
    const res = await fetchPage({ dest: "empty" });
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("/_nitro/dev/reload");
  });

  test("makes the HTML error page wait for the next server reload", async () => {
    const res = await fetchPage();
    expect(res.status).toBe(500);
    const html = await res.text();
    const { id, v } = await reloadState();
    expect(html).toContain("broken page");
    expect(html).toContain(JSON.stringify({ url: "/_nitro/dev/reload", id, v }));
    expect(html).not.toContain("@vite/client");
    expect(html.trimEnd().endsWith("</script>")).toBe(true);
  });

  test("does not answer waiting pages for files outside the module graph", async () => {
    const before = await reloadState();
    writeFileSync(notesFile, "changed");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(await reloadState()).toEqual(before);
  });

  test("answers waiting pages when a server module changes", async () => {
    const { id, v } = await reloadState();
    const waiting = reloadState(`id=${id}&v=${v}`);
    writeFileSync(stateFile, originalState.replace("true", "false"));
    expect((await waiting).v).toBeGreaterThan(v);

    let res = await fetchPage();
    for (let i = 0; i < 50 && res.status !== 200; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      res = await fetchPage();
    }
    expect(res.status).toBe(200);
    expect(await res.text()).not.toContain("/_nitro/dev/reload");
  });
});

describe("vite: dev error page recovery (base, middleware mode)", { concurrent: false }, () => {
  const rootDir = fileURLToPath(new URL("./dev-error-page-fixture", import.meta.url));
  const page = (url: string) =>
    fetch(url, { headers: { accept: "text/html", "sec-fetch-dest": "document" } });
  const reloadURL = (html: string) => JSON.parse(html.match(/const state = (\{.*?\});/)![1]!).url;

  test("waits on the reload route outside the Vite `base`", async () => {
    process.chdir(rootDir);
    const server = await createServer({ root: rootDir, logLevel: "warn", base: "/foo/" });
    try {
      await server.listen("0" as unknown as number);
      const origin = server.resolvedUrls!.local[0]!.replace(/\/foo\/$/, "");
      const res = await page(`${origin}/`);
      expect(res.status).toBe(500);
      const url = reloadURL(await res.text());
      const reload = await fetch(`${origin}${url}?id=none`);
      expect(reload.status).toBe(200);
      expect(await reload.json()).toMatchObject({ v: expect.any(Number) });
    } finally {
      await server.close();
    }
  });

  test("waits on the reload route under the Nitro `baseURL`", async () => {
    process.chdir(rootDir);
    const { nitro } = await import("nitro/vite");
    const server = await createServer({
      root: rootDir,
      logLevel: "warn",
      configFile: false,
      plugins: [nitro({ serverDir: "./", baseURL: "/app/" })],
    });
    try {
      await server.listen("0" as unknown as number);
      const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
      const res = await page(`${origin}/app/`);
      expect(res.status).toBe(500);
      const url = reloadURL(await res.text());
      expect(url).toBe("/app/_nitro/dev/reload");
      expect((await fetch(`${origin}${url}?id=none`)).status).toBe(200);
    } finally {
      await server.close();
    }
  });

  test("gives a restarted server with inline plugins a new reload state", async () => {
    process.chdir(rootDir);
    const { nitro } = await import("nitro/vite");
    const server = await createServer({
      root: rootDir,
      logLevel: "warn",
      configFile: false,
      plugins: [nitro({ serverDir: "./" })],
    });
    try {
      await server.listen("0" as unknown as number);
      const reloadState = async () => {
        const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
        return fetch(`${origin}/_nitro/dev/reload?id=none`);
      };
      const before = await reloadState();
      expect(before.status).toBe(200);
      const { id } = (await before.json()) as { id: string };

      await server.restart();
      const after = await reloadState();
      expect(after.status).toBe(200);
      expect(((await after.json()) as { id: string }).id).not.toBe(id);
    } finally {
      await server.close();
    }
  });

  test("answers waiting pages when Vite closes in middleware mode", async () => {
    process.chdir(rootDir);
    const vite = await createServer({
      root: rootDir,
      logLevel: "warn",
      server: { middlewareMode: true },
    });
    const host = createHTTPServer(vite.middlewares);
    try {
      await new Promise<void>((resolve) => host.listen(0, "127.0.0.1", resolve));
      const origin = `http://127.0.0.1:${(host.address() as { port: number }).port}`;
      const html = await (await page(`${origin}/`)).text();
      const { id, v } = (await (await fetch(`${origin}${reloadURL(html)}?id=none`)).json()) as {
        id: string;
        v: number;
      };
      const waiting = fetch(`${origin}${reloadURL(html)}?id=${id}&v=${v}`).then((r) => r.status);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const start = Date.now();
      await vite.close();
      expect(await waiting).toBe(503);
      await new Promise<void>((resolve) => host.close(() => resolve()));
      expect(Date.now() - start).toBeLessThan(5000);
    } finally {
      await vite.close();
      host.closeAllConnections();
      host.close();
    }
  });
});
