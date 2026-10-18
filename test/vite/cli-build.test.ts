import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { runCommand } from "citty";
import { join } from "pathe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import buildCommand from "../../src/cli/commands/build.ts";

// `nitro build` with the vite builder must copy public assets and prerender only once,
// from the vite `buildApp` hook (after the client build), not also from the CLI.
describe("vite: nitro build CLI", () => {
  const rootDir = fileURLToPath(new URL("./cli-build-fixture", import.meta.url));
  let tmpDir: string;
  let logFile: string;

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "nitro-cli-build-"));
    logFile = join(tmpDir, "build.log");
    writeFileSync(logFile, "");
    process.env.NITRO_TEST_CLI_BUILD_LOG = logFile;
    await runCommand(buildCommand, { rawArgs: ["--dir", rootDir] });
  }, 60_000);

  afterAll(() => {
    delete process.env.NITRO_TEST_CLI_BUILD_LOG;
    rmSync(tmpDir, { recursive: true, force: true });
    rmSync(join(rootDir, ".output"), { recursive: true, force: true });
  });

  it("prerenders and runs `close` hooks once", () => {
    const log = readFileSync(logFile, "utf8").split("\n").filter(Boolean);
    expect(log).toEqual(["prerender:init", "close"]);
  });

  it("writes prerendered routes", () => {
    expect(existsSync(join(rootDir, ".output/public/index.html"))).toBe(true);
  });
});
