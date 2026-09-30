import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { readFile, rm, mkdir } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { createNitro, build, prepare } from "nitro/builder";

const fixtureDir = fileURLToPath(new URL("./prerender-baseurl-fixture", import.meta.url));
const outDir = join(fixtureDir, ".tmp");

// https://github.com/nitrojs/nitro/issues/4441
describe("prerender with baseURL", () => {
  const routes: string[] = [];

  beforeAll(async () => {
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });
    const nitro = await createNitro({
      rootDir: fixtureDir,
      output: { dir: outDir },
      builder: "vite",
    });
    nitro.hooks.hook("prerender:route", (route) => {
      routes.push(route.route);
    });
    try {
      await prepare(nitro);
      await build(nitro);
    } finally {
      await nitro.close();
    }
  }, 30_000);

  it("renders crawled links once, without the baseURL prefix", () => {
    expect(routes.sort()).toEqual(["/", "/about", "/base/about"]);
  });

  it("fetches and writes crawled links by their original path", async () => {
    const read = (file: string) => readFile(join(outDir, "public", file), "utf8");
    expect(await read("index.html")).toContain("<h1>/base</h1>");
    expect(await read("about/index.html")).toContain("<h1>/base/about</h1>");
    // `/base/base/about` is the `/base/about` route, not a duplicate of `/about`
    expect(await read("base/about/index.html")).toContain("<h1>/base/base/about</h1>");
  });

  it("applies `prerender.ignore` to crawled links", () => {
    expect(routes).not.toContain("/admin");
    expect(routes).not.toContain("/base/admin");
  });
});
