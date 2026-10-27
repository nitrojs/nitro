import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runCommand } from "citty";
import { join } from "pathe";
import { afterAll, describe, expect, it } from "vitest";
import buildCommand from "../../src/cli/commands/build.ts";
import { cleanupFixtures, prerenderFixture } from "./_utils.ts";

const rootDir = fileURLToPath(new URL("./env-name-fixture", import.meta.url));

describe("prerender env name", () => {
  afterAll(async () => {
    await cleanupFixtures(["env-name-fixture"]);
    await rm(join(rootDir, ".output"), { recursive: true, force: true });
  });

  it("renders routes with the env name and overrides of the main build", async () => {
    const { outDir } = await prerenderFixture("env-name-fixture", {
      c12: { envName: "staging" },
    });
    expect(await readFile(join(outDir, "public/index.html"), "utf8")).toBe(
      `<!DOCTYPE html><html><body>staging staging</body></html>`
    );
  }, 120_000);

  it("uses the `--envName` flag of `nitro build`", async () => {
    await runCommand(buildCommand, { rawArgs: ["--dir", rootDir, "--envName", "staging"] });
    expect(await readFile(join(rootDir, ".output/public/index.html"), "utf8")).toBe(
      `<!DOCTYPE html><html><body>staging staging</body></html>`
    );
  }, 120_000);
});
