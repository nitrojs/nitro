import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { join } from "pathe";
import { afterAll, describe, expect, test } from "vitest";

// Vitest runs test files in the `nitro` Vite environment, without starting the dev worker.
describe("vite: vitest", () => {
  const rootDir = fileURLToPath(new URL("./vitest-fixture", import.meta.url));
  const tmpDir = mkdtempSync(join(tmpdir(), "nitro-vitest-"));
  const logFile = join(tmpDir, "close.log");
  writeFileSync(logFile, "");

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("runs tests against the nitro runtime", async () => {
    const { exitCode, stdout, stderr } = await execa(
      process.execPath,
      [fileURLToPath(new URL("vitest.mjs", import.meta.resolve("vitest/package.json"))), "run"],
      {
        cwd: rootDir,
        env: { NITRO_TEST_CLOSE_LOG: logFile, NO_COLOR: "1" },
        reject: false,
      }
    );
    const output = stdout + stderr;
    expect(output).toContain("Tests  6 passed (6)");
    expect(exitCode, output).toBe(0);
    // One app per test file that uses it (`node.spec.ts` does not)
    expect(readFileSync(logFile, "utf8")).toBe("runtime:close\n".repeat(2));
  }, 60_000);
});
