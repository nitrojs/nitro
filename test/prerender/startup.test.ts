import { mkdir, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import { build, copyPublicAssets, createNitro, prepare, prerender } from "nitro/builder";
import { afterAll, describe, expect, it } from "vitest";

const tmpDir = fileURLToPath(new URL("./.tmp", import.meta.url));

describe("prerender worker startup", () => {
  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("waits for a slow-starting worker before rendering the first route", async () => {
    const { nitro, outDir } = await prerenderFixture("slow-start-fixture");

    const routes = nitro._prerenderedRoutes!;
    expect(routes.map((r) => [r.route, r.error?.status])).toEqual([["/", undefined]]);
    expect(await readFile(join(outDir, "public/index.html"), "utf8")).toBe(
      `<!DOCTYPE html><html><body>rendered /</body></html>`
    );
  }, 120_000);

  it("fails when the worker cannot start", async () => {
    const start = Date.now();
    await expect(prerenderFixture("failing-start-fixture")).rejects.toThrow(
      "prerender entry failed to start"
    );
    // the worker's init error fails the build, without waiting out the ready timeout
    expect(Date.now() - start).toBeLessThan(10_000);
  }, 120_000);
});

async function prerenderFixture(name: string) {
  const outDir = join(tmpDir, name);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const nitro = await createNitro({
    rootDir: fileURLToPath(new URL(`./${name}`, import.meta.url)),
    preset: "static",
    output: { dir: outDir },
    prerender: { crawlLinks: false, routes: ["/"] },
  });

  try {
    await prepare(nitro);
    await copyPublicAssets(nitro);
    await prerender(nitro);
    await build(nitro);
  } finally {
    await nitro.close();
  }

  return { nitro, outDir };
}
