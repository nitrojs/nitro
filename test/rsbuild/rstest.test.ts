import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { join } from "pathe";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cleanEnv, copyFixture, runRstest } from "./_rstest.ts";

// Rstest builds test files with the server build config of Nitro (`nitro/rsbuild` plugin).
// Fixtures run outside of the repository, where only the project dependencies resolve.
describe("rsbuild: rstest", () => {
  let rootDir: string;

  beforeAll(async () => {
    rootDir = await copyFixture(fileURLToPath(new URL("./rstest-fixture", import.meta.url)));
  });

  afterAll(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  test("runs tests against the nitro runtime", async () => {
    await runFixture([]);
  }, 60_000);

  test("supports the plugin in one of the projects", async () => {
    await runFixture(["--config", "rstest.projects.config.ts"]);
  }, 60_000);

  test("keeps the nitro loader with custom rspack rules", async () => {
    await runFixture(["--config", "rstest.rules.config.ts"]);
  }, 60_000);

  async function runFixture(args: string[]) {
    const logFile = join(rootDir, "close.log");
    writeFileSync(logFile, "");
    const { results, failures, output } = await runRstest(rootDir, {
      args,
      env: { NITRO_TEST_CLOSE_LOG: logFile },
    });
    expect(failures, output).toEqual([]);
    expect(results.summary.passedTests, output).toBe(7);
    // One app per test file that uses it (`no-app.spec.ts` does not)
    expect(readFileSync(logFile, "utf8")).toBe("runtime:close:200\n".repeat(3));
  }
});

// Rstest watch mode reruns tests on route edits and added or removed handlers.
describe("rsbuild: rstest watch", () => {
  let rootDir: string;

  beforeAll(async () => {
    rootDir = await copyFixture(fileURLToPath(new URL("./rstest-watch-fixture", import.meta.url)));
  });

  afterAll(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  const waitFor = async (condition: () => boolean) => {
    const deadline = Date.now() + 30_000;
    while (!condition() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };

  test("reruns tests on route and scan dir changes", async () => {
    const logFile = join(rootDir, "watch.log");
    const routeFile = join(rootDir, "routes/hello.ts");
    const addedRouteFile = join(rootDir, "routes/added.ts");
    const utilFile = join(rootDir, "utils/version.ts");
    writeFileSync(logFile, "");
    const runs = () =>
      readFileSync(logFile, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));

    const child = execa(
      process.execPath,
      [join(rootDir, "node_modules/@rstest/core/bin/rstest.js"), "watch"],
      {
        cwd: rootDir,
        env: cleanEnv({ NITRO_TEST_WATCH_LOG: logFile }),
        extendEnv: false,
        reject: false,
        all: true,
      }
    );
    let output = "";
    child.all?.on("data", (chunk) => (output += chunk));

    const expected: Record<string, unknown>[] = [];
    const step = async (change: () => void, state: Record<string, unknown>) => {
      change();
      expected.push({ ...expected.at(-1), ...state });
      await waitFor(() => runs().length >= expected.length);
      expect(runs(), output).toEqual(expected);
    };
    const edit = (file: string, from: string, to: string) => () =>
      writeFileSync(file, readFileSync(file, "utf8").replace(from, to));

    try {
      await step(() => {}, { hello: "hello v1", added: 404, version: "v1" });
      // Route edits (only imported through virtual modules)
      await step(edit(routeFile, "`hello", "`hi"), { hello: "hi v1" });
      // A file imported by the test and by a route reruns the test once
      await step(edit(utilFile, "v1", "v2"), { hello: "hi v2", version: "v2" });
      // Added and removed routes
      await step(
        () =>
          writeFileSync(
            addedRouteFile,
            `import { defineHandler } from "nitro";\nexport default defineHandler(() => "added");\n`
          ),
        { added: 200 }
      );
      await step(() => rmSync(addedRouteFile), { added: 404 });
      // No late duplicate runs
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(runs(), output).toEqual(expected);
    } finally {
      child.kill();
      await child;
    }
  }, 120_000);
});
