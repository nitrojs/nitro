import { fileURLToPath } from "node:url";
import { createRsbuild, type RsbuildConfig, type RsbuildPlugin } from "@rsbuild/core";
import { describe, expect, test } from "vitest";
import { nitro } from "../../src/rsbuild.ts";
import { type FixtureContext, htmlHeaders, setupFixture } from "./_utils.ts";

describe.each(["dev", "prod"] as const)("rsbuild (%s)", (mode) => {
  describe("spa", () => {
    const spaConfig: RsbuildConfig = {
      plugins: [nitro({ serverDir: "./", features: { websocket: true }, ...testConfig })],
    };
    const ctx = setupFixture("spa-fixture", mode, spaConfig);

    test("serves nitro routes", async () => {
      const res = await ctx.fetch("/api/hello");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ api: "hello" });
    });

    test("serves the client html with its scripts", async () => {
      const res = await ctx.fetch("/", { headers: htmlHeaders });
      expect(res.status).toBe(200);
      const scripts = [...(await res.text()).matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)];
      expect(scripts.length).toBeGreaterThan(0);
      for (const [, src] of scripts) {
        const asset = await ctx.fetch(src!);
        expect(asset.status, src).toBe(200);
        expect(await asset.text()).toContain("client");
        if (mode === "prod") {
          expect(asset.headers.get("cache-control"), src).toContain("immutable");
        }
      }
    });

    test.runIf(mode === "prod")("responds with an uncached 404 to missing assets", async () => {
      await expectMissingAsset(ctx, "/static/js/missing.js");
    });

    test("serves public assets", async () => {
      const res = await ctx.fetch("/robots.txt");
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("User-agent");
    });

    test.runIf(mode === "prod")("rsbuild preview serves the nitro build", async () => {
      const rsbuild = await createRsbuild({
        cwd: fileURLToPath(new URL("spa-fixture", import.meta.url)),
        config: { ...spaConfig, logLevel: "warn", server: { port: 0, host: "127.0.0.1" } },
      });
      const { urls, server } = await rsbuild.preview({ getPortSilently: true });
      try {
        const url = new URL(urls[0]!).origin;
        const api = await fetch(`${url}/api/hello`);
        expect(await api.json()).toEqual({ api: "hello" });
        const page = await fetch(url, { headers: htmlHeaders });
        expect(await page.text()).toMatch(/<script\b[^>]*\bsrc="[^"]+"/);
      } finally {
        await server.close();
      }
    });

    test.runIf(mode === "dev")("handles websockets", async () => {
      const ws = new WebSocket(ctx.url!.replace("http", "ws") + "/api/ws");
      const message = await new Promise<string>((resolve, reject) => {
        ws.addEventListener("open", () => ws.send("ping"));
        ws.addEventListener("message", (event) => resolve(String(event.data)));
        ws.addEventListener("error", () => reject(new Error("websocket error")));
      }).finally(() => ws.close());
      expect(message).toBe("echo:ping");
    });
  });

  describe("ssr", () => {
    const ctx = setupFixture("ssr-fixture", mode, {
      source: { entry: { index: "./src/entry-client.js" } },
      html: { template: "./index.html" },
      plugins: [
        nitro({
          serverDir: "./",
          runtimeConfig: { greeting: "from nitro" },
          services: { api: { entry: "./src/api-entry.js" } },
          ...testConfig,
        }),
      ],
    });

    test("serves nitro routes", async () => {
      const res = await ctx.fetch("/api/hello");
      expect(await res.json()).toEqual({ api: "hello" });
    });

    test("fetches services of the `services` option", async () => {
      const res = await ctx.fetch("/api/service");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        service: "api",
        greeting: "from nitro",
        page: '<p id="ssr">/api/service from nitro</p>',
      });
    });

    test("renders pages with the ssr environment", async () => {
      for (const path of ["/", "/about"]) {
        const res = await ctx.fetch(path, { headers: htmlHeaders });
        expect(res.status, path).toBe(200);
        const body = await res.text();
        expect(body).toContain(`<p id="ssr">${path} from nitro</p>`);
        expect(body).not.toContain("<!--ssr-outlet-->");
        expect(body).toMatch(/<script\b[^>]*\bsrc="[^"]+"/);
      }
    });

    // The SSR renderer must not answer asset loads Rsbuild cannot serve with a page
    test.runIf(mode === "dev")("responds 404 to missing assets", async () => {
      const requests: [string, Record<string, string>][] = [
        ["/static/js/missing.js", { "sec-fetch-dest": "script", accept: "*/*" }],
        ["/missing.png", { accept: "image/*" }],
        ["/missing.css", {}],
      ];
      for (const [path, headers] of requests) {
        const res = await ctx.fetch(path, { headers });
        expect(res.status, path).toBe(404);
        expect(await res.text(), path).not.toContain('<p id="ssr">');
      }
    });
  });

  describe("ssr (baseURL)", () => {
    const ctx = setupFixture(
      "ssr-fixture",
      mode,
      {
        source: { entry: { index: "./src/entry-client.js" } },
        html: { template: "./index.html" },
        plugins: [
          nitro({
            serverDir: "./",
            baseURL: "/app/",
            runtimeConfig: { greeting: "from nitro" },
            output: { dir: ".output/base" },
            ...testConfig,
          }),
        ],
      },
      { outDir: ".output/base" }
    );

    test("serves nitro routes under the base", async () => {
      const res = await ctx.fetch("/app/api/hello");
      expect(await res.json()).toEqual({ api: "hello" });
    });

    test("renders pages under the base with their scripts", async () => {
      for (const path of ["/app/", "/app/about"]) {
        const res = await ctx.fetch(path, { headers: htmlHeaders });
        expect(res.status, path).toBe(200);
        const body = await res.text();
        expect(body).toContain(`<p id="ssr">${path} from nitro</p>`);
        const scripts = [...body.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]!);
        expect(scripts.length).toBeGreaterThan(0);
        for (const src of scripts) {
          expect(src).toMatch(/^\/app\//);
          const asset = await ctx.fetch(src);
          expect(asset.status, src).toBe(200);
          expect(await asset.text(), src).toContain("hydrated");
        }
      }
    });
  });

  // Pages are owned by the `client` environment (then `web`, then the first client environment)
  describe("ssr (multiple client environments)", () => {
    const ctx = setupFixture(
      "ssr-fixture",
      mode,
      {
        html: { template: "./index.html" },
        environments: {
          admin: { source: { entry: { admin: "./src/admin.js" } } },
          client: { source: { entry: { index: "./src/entry-client.js" } } },
        },
        plugins: [
          nitro({
            serverDir: "./",
            runtimeConfig: { greeting: "from nitro" },
            output: { dir: ".output/envs" },
            ...testConfig,
          }),
        ],
      },
      { outDir: ".output/envs" }
    );

    test("renders pages with the html of the client environment", async () => {
      const res = await ctx.fetch("/about", { headers: htmlHeaders });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('<p id="ssr">/about from nitro</p>');
      const scripts = [...body.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]!);
      expect(scripts.length).toBeGreaterThan(0);
      for (const src of scripts) {
        expect(src).not.toContain("admin");
        const asset = await ctx.fetch(src);
        expect(asset.status, src).toBe(200);
      }
    });
  });

  describe("ssr (full document)", () => {
    const ctx = setupFixture("ssr-fetch-fixture", mode, {
      source: { entry: { index: "./src/entry-client.js" } },
      // Dynamic imports are compiled when loaded by default
      dev: { lazyCompilation: false },
      plugins: [nitro({ serverDir: "./", ...testConfig })],
    });

    test("renders pages with the client assets", async () => {
      const res = await ctx.fetch("/about", { headers: htmlHeaders });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toMatch(/<p id="ssr" data-style="[^"]+\.css">\/about<\/p>/);
      const scripts = [...body.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]!);
      const styles = [...body.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]!);
      expect(scripts.length).toBeGreaterThan(0);
      expect(styles.length).toBe(1);
      for (const url of [...scripts, ...styles]) {
        const asset = await ctx.fetch(url);
        expect(asset.status, url).toBe(200);
      }
    });

    test("collects the assets of `?assets` imports", async () => {
      const result = (await ctx.fetch("/_assets").then((r) => r.json())) as AssetsImports;
      const href = (re: RegExp) => ({ href: expect.stringMatching(re) });
      expect(result.client).toEqual({
        entry: expect.stringMatching(/^\/static\/js\/index(\.\w+)?\.js$/),
        js: expect.arrayContaining([{ href: result.client.entry }]),
        css: [href(/^\/static\/css\/index(\.\w+)?\.css$/)],
      });
      expect(result.client.js.at(-1)!.href).toBe(result.client.entry);
      // CSS imported by server modules is not collected
      expect(result.server).toEqual({ js: [], css: [] });
      // Dynamic import of the client
      expect(result.lazy).toEqual({
        entry: expect.stringMatching(/^\/static\/js\/async\/.+\.js$/),
        js: expect.arrayContaining([{ href: result.lazy.entry }]),
        css: [href(/^\/static\/css\/async\/.+\.css$/)],
      });
      expect(result.merged).toEqual({
        entry: result.client.entry,
        js: [...result.client.js, ...result.lazy.js],
        css: [...result.client.css, ...result.lazy.css],
      });
      for (const { href } of [...result.merged.js, ...result.merged.css]) {
        const asset = await ctx.fetch(href);
        expect(asset.status, href).toBe(200);
      }
      const nitroAssets = await ctx.fetch("/api/assets").then((r) => r.json());
      expect(nitroAssets).toEqual(result.client);
    });
  });

  describe("ssr (full document, baseURL)", () => {
    const ctx = setupFixture(
      "ssr-fetch-fixture",
      mode,
      {
        source: { entry: { index: "./src/entry-client.js" } },
        dev: { lazyCompilation: false },
        plugins: [
          nitro({
            serverDir: "./",
            baseURL: "/app/",
            output: { dir: ".output/base" },
            ...testConfig,
          }),
        ],
      },
      { outDir: ".output/base" }
    );

    test("collects the assets of `?assets` imports under the base", async () => {
      const result = (await ctx.fetch("/app/_assets").then((r) => r.json())) as AssetsImports;
      const hrefs = [...result.merged.js, ...result.merged.css].map((asset) => asset.href);
      expect(hrefs.length).toBe(4);
      for (const href of hrefs) {
        expect(href).toMatch(/^\/app\/static\//);
        const asset = await ctx.fetch(href);
        expect(asset.status, href).toBe(200);
      }
      const page = await ctx.fetch("/app/about", { headers: htmlHeaders }).then((r) => r.text());
      expect(page).toContain(`<script defer src="${result.client.entry}">`);
    });
  });

  // Environments added by a framework plugin (e.g. TanStack Start), with their own output dirs
  describe("ssr (environments of other plugins)", () => {
    const frameworkPlugin: RsbuildPlugin = {
      name: "framework",
      setup(api) {
        api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) =>
          mergeRsbuildConfig(config, {
            environments: {
              client: {
                source: { entry: { index: "./src/entry-client.js" } },
                output: { target: "web", distPath: { root: "dist/client" } },
              },
              ssr: {
                source: { entry: { index: "./src/entry-server.js" } },
                output: { target: "node", distPath: { root: "dist/server" } },
              },
            },
          })
        );
      },
    };
    const pluginEnvsConfig: RsbuildConfig = {
      plugins: [
        nitro({ serverDir: "./", output: { dir: ".output/plugin" }, ...testConfig }),
        frameworkPlugin,
      ],
    };
    const ctx = setupFixture("ssr-fetch-fixture", mode, pluginEnvsConfig, {
      outDir: ".output/plugin",
    });

    test.runIf(mode === "prod")("rsbuild preview serves the nitro build", async () => {
      const rsbuild = await createRsbuild({
        cwd: fileURLToPath(new URL("ssr-fetch-fixture", import.meta.url)),
        config: { ...pluginEnvsConfig, logLevel: "warn", server: { port: 0, host: "127.0.0.1" } },
      });
      const { urls, server } = await rsbuild.preview({ getPortSilently: true });
      try {
        const page = await fetch(new URL("/about", urls[0]!), { headers: htmlHeaders });
        expect(page.status).toBe(200);
        expect(await page.text()).toContain("/about</p>");
      } finally {
        await server.close();
      }
    });

    test("renders pages with the ssr environment and serves the client assets", async () => {
      const res = await ctx.fetch("/about", { headers: htmlHeaders });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toMatch(/<p id="ssr" data-style="[^"]+\.css">\/about<\/p>/);
      const scripts = [...body.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]!);
      expect(scripts.length).toBeGreaterThan(0);
      for (const src of scripts) {
        const asset = await ctx.fetch(src);
        expect(asset.status, src).toBe(200);
      }
    });
  });

  describe("baseURL", () => {
    const ctx = setupFixture(
      "spa-fixture",
      mode,
      {
        plugins: [
          nitro({
            serverDir: "./",
            baseURL: "/app/",
            output: { dir: ".output/base" },
            ...testConfig,
          }),
        ],
      },
      { outDir: ".output/base" }
    );

    test("serves nitro routes under the base", async () => {
      const res = await ctx.fetch("/app/api/hello");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ api: "hello" });
    });

    test("serves the client html and assets under the base", async () => {
      const res = await ctx.fetch("/app/", { headers: htmlHeaders });
      expect(res.status).toBe(200);
      const scripts = [...(await res.text()).matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)];
      expect(scripts.length).toBeGreaterThan(0);
      for (const [, src] of scripts) {
        expect(src).toMatch(/^\/app\//);
        const asset = await ctx.fetch(src!);
        expect(asset.status, src).toBe(200);
        expect(await asset.text()).toContain("client");
        if (mode === "prod") {
          expect(asset.headers.get("cache-control"), src).toContain("immutable");
        }
      }
      const robots = await ctx.fetch("/app/robots.txt");
      expect(robots.status).toBe(200);
    });

    test.runIf(mode === "prod")("responds with an uncached 404 to missing assets", async () => {
      await expectMissingAsset(ctx, "/app/static/js/missing.js");
    });
  });
});

const testConfig = { preset: "standard", serveStatic: true } as const;

async function expectMissingAsset(ctx: FixtureContext, path: string) {
  const res = await ctx.fetch(path, { headers: { "sec-fetch-dest": "script", accept: "*/*" } });
  expect(res.status, path).toBe(404);
  expect(res.headers.get("cache-control"), path).toBe("no-store");
  expect(await res.text(), path).not.toMatch(/<script\b/);
}

type Assets = { entry?: string; js: { href: string }[]; css: { href: string }[] };
type AssetsImports = Record<"client" | "server" | "lazy" | "merged", Assets>;
