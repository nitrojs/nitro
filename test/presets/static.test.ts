import fsp from "node:fs/promises";
import { resolve } from "pathe";
import { describe, expect, it } from "vitest";
import { setupTest } from "../tests.ts";

describe("nitro:preset:static", async () => {
  const ctx = await setupTest("static");
  it("should not generate a server folder", async () => {
    const contents = (await fsp.readdir(resolve(ctx.outDir))).sort();
    expect(contents).toMatchInlineSnapshot(`
      [
        "nitro.json",
        "public",
      ]
    `);
  });
});

describe.each([false, true])("prerender headers (crawlLinks: %s)", async (crawlLinks) => {
  const processed = new Map<string, { skip?: boolean; error?: boolean }>();
  const types = [
    "html",
    "json",
    "text",
    "skipped-html",
    "skipped-json",
    "error-html",
    "error-json",
  ];
  const ctx = await setupTest("static", {
    outDirSuffix: `-headers-${crawlLinks}`,
    config: {
      handlers: [{ route: "/prerender-header/:type", handler: "./prerender-header.ts" }],
      prerender: { crawlLinks, failOnError: false },
      hooks: {
        "prerender:routes"(routes) {
          routes.clear();
          for (const type of types) {
            routes.add(`/prerender-header/${type}`);
          }
        },
        "prerender:generate"(route) {
          if (route.route.startsWith("/prerender-header/skipped-")) {
            route.skip = true;
          }
        },
        "prerender:route"(route) {
          processed.set(route.route, { skip: route.skip, error: !!route.error });
        },
      },
    },
  });

  it.each(["html", "json", "text"])("follows the header on a %s response", async (type) => {
    expect(processed.get(`/prerender-header/${type}`)).toMatchObject({ error: false });
    expect(processed.has(`/api/param/header-${type}`)).toBe(true);
    expect(await fsp.readFile(resolve(ctx.outDir, `public/api/param/header-${type}`), "utf8")).toBe(
      `header-${type}`
    );
  });

  it("only crawls links in HTML bodies when enabled", () => {
    expect(processed.has("/api/param/body-html")).toBe(crawlLinks);
    expect(processed.has("/api/param/body-json")).toBe(false);
    expect(processed.has("/api/param/body-text")).toBe(false);
  });

  it.each(["html", "json"])("does not follow headers on skipped or failed %s responses", (type) => {
    expect(processed.get(`/prerender-header/skipped-${type}`)).toMatchObject({ skip: true });
    expect(processed.get(`/prerender-header/error-${type}`)).toMatchObject({ error: true });
    for (const prefix of ["skipped", "error"]) {
      expect(processed.has(`/api/param/header-${prefix}-${type}`)).toBe(false);
      expect(processed.has(`/api/param/body-${prefix}-${type}`)).toBe(false);
    }
  });
});
