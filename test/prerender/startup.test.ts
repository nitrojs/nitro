import { readFile } from "node:fs/promises";
import { join } from "pathe";
import { afterAll, describe, expect, it } from "vitest";
import { cleanupFixtures, prerenderFixture } from "./_utils.ts";

describe("prerender worker startup", () => {
  afterAll(async () => {
    await cleanupFixtures(["slow-start-fixture", "failing-start-fixture"]);
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
