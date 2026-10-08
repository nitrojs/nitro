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
  const resultsFile = join(tmpDir, "results.json");
  writeFileSync(logFile, "");

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    rmSync(join(rootDir, "node_modules"), { recursive: true, force: true });
  });

  test("runs tests against the nitro runtime", async () => {
    // A clean environment, as when users run Vitest (no `NODE_ENV` or `VITEST_*` from this run)
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => key !== "NODE_ENV" && !key.startsWith("VITEST"))
    );
    const { stdout, stderr } = await execa(
      process.execPath,
      [
        fileURLToPath(new URL("vitest.mjs", import.meta.resolve("vitest/package.json"))),
        "run",
        "--reporter=json",
        `--outputFile=${resultsFile}`,
      ],
      {
        cwd: rootDir,
        env: { ...env, NITRO_TEST_CLOSE_LOG: logFile },
        extendEnv: false,
        reject: false,
      }
    );
    const results = JSON.parse(readFileSync(resultsFile, "utf8"));
    const failures = results.testResults.flatMap((file: any) =>
      file.assertionResults
        .filter((t: any) => t.status !== "passed")
        .map((t: any) => `${t.fullName}: ${t.failureMessages.join("\n")}`)
    );
    expect(failures, stdout + stderr).toEqual([]);
    expect(results.numPassedTests).toBe(7);
    expect(results.success).toBe(true);
    // One app per test file that uses it (`node.spec.ts` does not)
    expect(readFileSync(logFile, "utf8")).toBe("runtime:close\n".repeat(3));
  }, 60_000);
});
