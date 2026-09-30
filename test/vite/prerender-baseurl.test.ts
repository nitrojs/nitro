import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { rm, mkdir } from "node:fs/promises";
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
    expect(routes.sort()).toEqual(["/", "/about"]);
  });

  it("applies `prerender.ignore` to crawled links", () => {
    expect(routes).not.toContain("/admin");
    expect(routes).not.toContain("/base/admin");
  });
});
