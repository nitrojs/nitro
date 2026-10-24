import { mkdir, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import { build, copyPublicAssets, createNitro, prepare, prerender } from "nitro/builder";
import { afterAll, describe, expect, it } from "vitest";

const fixtureDir = fileURLToPath(new URL("./env-name-fixture", import.meta.url));
const outDir = join(fixtureDir, ".tmp");

describe("prerender env name", () => {
  afterAll(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  it("renders routes with the env name of the main build", async () => {
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });

    const nitro = await createNitro(
      {
        rootDir: fixtureDir,
        preset: "static",
        output: { dir: outDir },
        prerender: { crawlLinks: false, routes: ["/"] },
      },
      { c12: { envName: "staging" } }
    );
    try {
      await prepare(nitro);
      await copyPublicAssets(nitro);
      await prerender(nitro);
      await build(nitro);
    } finally {
      await nitro.close();
    }

    expect(await readFile(join(outDir, "public/index.html"), "utf8")).toBe(
      `<!DOCTYPE html><html><body>staging</body></html>`
    );
  }, 120_000);
});
