import { mkdir, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import { build, copyPublicAssets, createNitro, prepare, prerender } from "nitro/builder";
import { afterAll, describe, expect, it } from "vitest";

const fixtureDir = fileURLToPath(new URL("./fixture", import.meta.url));
const tmpDir = fileURLToPath(new URL("./.tmp", import.meta.url));

describe("prerender output collision", () => {
  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("keeps the first route's output and warns instead of overwriting it", async () => {
    const outDir = join(tmpDir, "output");
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });

    const nitro = await createNitro({
      rootDir: fixtureDir,
      preset: "static",
      output: { dir: outDir },
      prerender: {
        crawlLinks: false,
        // one at a time, so the route that claims the file is the first one listed
        concurrency: 1,
        // both resolve to `other/index.html`
        routes: ["/other", "/other/index.html"],
      },
    });

    const warnings: string[] = [];
    nitro.logger.warn = ((...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    }) as typeof nitro.logger.warn;

    try {
      await prepare(nitro);
      await copyPublicAssets(nitro);
      await prerender(nitro);
      await build(nitro);
    } finally {
      await nitro.close();
    }

    const collisionWarnings = warnings.filter((w) => w.includes("both prerender to"));
    expect(collisionWarnings).toHaveLength(1);
    expect(collisionWarnings[0]).toContain("/other");
    expect(collisionWarnings[0]).toContain("/other/index.html");

    // only one of the two routes may claim the file, and it is the one rendered first
    const written = nitro._prerenderedRoutes!.filter((r) => r.fileName === "/other/index.html");
    expect(written).toHaveLength(1);
    expect(written[0].route).toBe("/other");

    // and the file holds that route's render, whole
    const contents = await readFile(join(outDir, "public/other/index.html"), "utf8");
    expect(contents).toBe(`<!DOCTYPE html><html><body>rendered /other</body></html>`);
  }, 120_000);
});
