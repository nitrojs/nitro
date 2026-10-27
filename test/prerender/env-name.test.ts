import { readFile } from "node:fs/promises";
import { join } from "pathe";
import { afterAll, describe, expect, it } from "vitest";
import { cleanupFixtures, prerenderFixture } from "./_utils.ts";

describe("prerender env name", () => {
  afterAll(async () => {
    await cleanupFixtures(["env-name-fixture"]);
  });

  it("renders routes with the env name and overrides of the main build", async () => {
    const { outDir } = await prerenderFixture("env-name-fixture", {
      c12: { envName: "staging" },
    });
    expect(await readFile(join(outDir, "public/index.html"), "utf8")).toBe(
      `<!DOCTYPE html><html><body>staging staging</body></html>`
    );
  }, 120_000);
});
