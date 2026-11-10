import { Miniflare } from "miniflare";
import { join } from "node:path";
import { isWindows } from "std-env";
import { describe, expect, test } from "vitest";
import { nitro } from "../../src/rsbuild.ts";
import { htmlHeaders, setupFixture, type FixtureOptions } from "./_utils.ts";

const cfConfig = {
  serverDir: "./",
  preset: "cloudflare-module",
  compatibilityDate: "2026-07-01",
  runtimeConfig: { greeting: "from nitro" },
  output: { dir: ".output/cf" },
  // Fixtures are shared with `rsbuild.test.ts` (running in parallel)
  buildDir: "node_modules/.nitro-cf",
} as const;

const fixtureOptions: FixtureOptions = {
  outDir: ".output/cf",
  async serve(outDir) {
    const mf = new Miniflare({
      modules: true,
      scriptPath: join(outDir, "server/index.mjs"),
      compatibilityDate: "2026-07-01",
      compatibilityFlags: ["nodejs_compat"],
      assets: {
        directory: join(outDir, "public"),
        routerConfig: { has_user_worker: true },
      },
    });
    return {
      fetch: (path, init) =>
        mf.dispatchFetch(new URL(path, "http://localhost"), init as any) as any,
      close: () => mf.dispose(),
    };
  },
};

// TODO: rspack on Windows (https://github.com/nitrojs/nitro/issues/4948)
describe.skipIf(isWindows).each(["dev", "prod"] as const)("rsbuild cloudflare (%s)", (mode) => {
  describe("ssr", () => {
    const ctx = setupFixture(
      "ssr-fixture",
      mode,
      {
        source: { entry: { index: "./src/entry-client.js" } },
        html: { template: "./index.html" },
        plugins: [nitro(cfConfig)],
      },
      fixtureOptions
    );

    test("serves nitro routes", async () => {
      const res = await ctx.fetch("/api/hello");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ api: "hello" });
    });

    test("renders pages with the ssr environment", async () => {
      const res = await ctx.fetch("/about", { headers: htmlHeaders });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('<p id="ssr">/about from nitro</p>');
      const scripts = [...body.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]!);
      expect(scripts.length).toBeGreaterThan(0);
      for (const src of scripts) {
        const asset = await ctx.fetch(src);
        expect(asset.status, src).toBe(200);
      }
    });
  });

  describe("ssr (full document)", () => {
    const ctx = setupFixture(
      "ssr-fetch-fixture",
      mode,
      {
        source: { entry: { index: "./src/entry-client.js" } },
        plugins: [nitro(cfConfig)],
      },
      fixtureOptions
    );

    test("renders pages with the client assets", async () => {
      const res = await ctx.fetch("/about", { headers: htmlHeaders });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toMatch(/<p id="ssr" data-style="[^"]+\.css">\/about<\/p>/);
      const scripts = [...body.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]!);
      expect(scripts.length).toBeGreaterThan(0);
    });

    test("collects the assets of `?assets` imports", async () => {
      const result = (await ctx.fetch("/_assets").then((r) => r.json())) as {
        client: { entry?: string };
      };
      expect(result.client.entry).toMatch(/^\/static\/js\/.+\.js$/);
      expect(await ctx.fetch("/api/assets").then((r) => r.json())).toEqual(result.client);
    });
  });
});
