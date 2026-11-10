import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "pathe";
import type { ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { createServer, createBuilder } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

const rootDir = fileURLToPath(new URL("./assets-import-fixture", import.meta.url));

type Assets = {
  entry?: string;
  js: { href: string }[];
  css: { href: string; "data-vite-dev-id"?: string }[];
};
type Result = Record<"client" | "server" | "page" | "merged", Assets>;

describe("vite: `?assets` imports", () => {
  describe("dev", () => {
    let server: ViteDevServer;
    let serverURL: string;
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

    it("collects dev urls", async () => {
      const result = await fetch(serverURL)
        .then((r) => r.json())
        .then((r: any) => r.assets as Result);
      const css = (name: string) => ({ href: `/${name}`, "data-vite-dev-id": join(rootDir, name) });
      expect(result.client).toEqual({ entry: "/entry-client.ts", js: [], css: [] });
      // Dev collects the CSS of dynamic imports too
      expect(result.server).toEqual({ js: [], css: [css("server.css"), css("page.css")] });
      expect(result.page).toEqual({ entry: "/page.ts", js: [], css: [css("page.css")] });
      expect(result.merged).toEqual({
        entry: "/entry-client.ts",
        js: [],
        css: [css("server.css"), css("page.css")],
      });
    });

    it("serves collected urls", async () => {
      const result = await fetch(serverURL)
        .then((r) => r.json())
        .then((r: any) => r.assets as Result);
      for (const href of [result.merged.entry!, ...result.merged.css.map((c) => c.href)]) {
        const res = await fetch(serverURL + href);
        expect(res.status, href).toBe(200);
      }
    });

    it("collects the css of modules not loaded yet", async () => {
      expect(await fetch(`${serverURL}/lazy`).then((r) => r.json())).toEqual({
        js: [],
        css: [{ href: "/lazy.css", "data-vite-dev-id": join(rootDir, "lazy.css") }],
      });
    });

    it("collects assets imported by other environments", async () => {
      const result = await fetch(serverURL).then((r) => r.json() as Promise<{ assets: Result }>);
      expect(await fetch(`${serverURL}/api`).then((r) => r.json())).toEqual(result.assets.client);
    });

    it("patches the vite client to update collected css links", async () => {
      const code = await fetch(`${serverURL}/@vite/client`).then((r) => r.text());
      expect(code).toContain("linkSheetsMap");
    });
  });

  describe("build", () => {
    const outDir = join(rootDir, ".output");
    let result: Result;
    let entryFetch: (req: Request) => Promise<Response>;
    const originalCwd = process.cwd();

    beforeAll(async () => {
      await rm(outDir, { recursive: true, force: true });
      process.chdir(rootDir);
      try {
        const builder = await createBuilder({
          root: rootDir,
          logLevel: "warn",
          nitro: { preset: "standard" },
        });
        await builder.buildApp();
      } finally {
        process.chdir(originalCwd);
      }
      const { default: entry } = await import(pathToFileURL(join(outDir, "server/index.mjs")).href);
      entryFetch = entry.fetch;
      result = await entryFetch(new Request("http://localhost/"))
        .then((r) => r.json() as Promise<{ assets: Result }>)
        .then((r) => r.assets);
    }, 60_000);

    it("collects built urls", () => {
      const asset = (re: RegExp) => ({ href: expect.stringMatching(re) });
      expect(result.client).toEqual({
        entry: expect.stringMatching(/^\/assets\/entry-client-[\w-]+\.js$/),
        js: [asset(/^\/assets\/entry-client-[\w-]+\.js$/)],
        css: [asset(/^\/assets\/entry-client-[\w-]+\.css$/)],
      });
      expect(result.server).toEqual({ js: [], css: [asset(/^\/assets\/[\w-]+\.css$/)] });
      // The client and ssr builds emit the same css file
      expect(result.page).toEqual({
        entry: expect.stringMatching(/^\/assets\/page-[\w-]+\.js$/),
        js: [asset(/^\/assets\/page-[\w-]+\.js$/)],
        css: [asset(/^\/assets\/page-[\w-]+\.css$/)],
      });
      expect(result.merged.entry).toBe(result.client.entry);
    });

    it("writes collected assets to the public output", () => {
      const hrefs = [
        result.merged.entry!,
        ...result.merged.js.map((a) => a.href),
        ...result.merged.css.map((a) => a.href),
      ];
      for (const href of hrefs) {
        expect(existsSync(join(outDir, "public", href)), href).toBe(true);
      }
    });

    it("collects assets imported by other environments", async () => {
      const res = await entryFetch(new Request("http://localhost/api"));
      expect(await res.json()).toEqual(result.client);
    });

    it("does not copy server build metadata to the public output", () => {
      expect(existsSync(join(outDir, "public/nitro-service.json"))).toBe(false);
    });
  });
});
