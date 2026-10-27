import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { join } from "pathe";
import { afterAll, describe, expect, test } from "vitest";

// Vitest watch mode reruns tests on server changes it does not track itself.
describe("vite: vitest watch", () => {
  const rootDir = fileURLToPath(new URL("./vitest-watch-fixture", import.meta.url));
  const tmpDir = mkdtempSync(join(tmpdir(), "nitro-vitest-watch-"));
  const logFile = join(tmpDir, "watch.log");
  const routeFile = join(rootDir, "routes/hello.ts");
  const addedRouteFile = join(rootDir, "routes/added.ts");
  const utilFile = join(rootDir, "utils/version.ts");
  const configFile = join(rootDir, "nitro.config.ts");
  const originals = new Map(
    [routeFile, utilFile, configFile].map((file) => [file, readFileSync(file, "utf8")])
  );
  writeFileSync(logFile, "");

  afterAll(() => {
    for (const [file, contents] of originals) {
      writeFileSync(file, contents);
    }
    rmSync(addedRouteFile, { force: true });
    rmSync(tmpDir, { recursive: true, force: true });
    rmSync(join(rootDir, "node_modules"), { recursive: true, force: true });
  });

  // A clean environment, as when users run Vitest (no `NODE_ENV` or `VITEST_*` from this run)
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key !== "NODE_ENV" && !key.startsWith("VITEST"))
  );
  const runs = () =>
    readFileSync(logFile, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  const waitFor = async (condition: () => boolean) => {
    const deadline = Date.now() + 30_000;
    while (!condition() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };

  test("reruns tests on route, scan dir and nitro config changes", async () => {
    const child = execa(
      process.execPath,
      [fileURLToPath(new URL("vitest.mjs", import.meta.resolve("vitest/package.json"))), "watch"],
      {
        cwd: rootDir,
        env: { ...env, NITRO_TEST_WATCH_LOG: logFile },
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
      await step(() => {}, { hello: "hello v1", added: 404, greeting: "hello", version: "v1" });
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
      // Nitro config (restarts Vitest), then route edits still rerun
      await step(edit(configFile, `"hello"`, `"hola"`), { greeting: "hola" });
      await step(edit(routeFile, "`hi", "`hey"), { hello: "hey v2" });
      // No late duplicate runs
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(runs(), output).toEqual(expected);
    } finally {
      child.kill();
      await child;
    }
  }, 120_000);

  test("keeps the watch filename filter on rescan reruns", async () => {
    writeFileSync(logFile, "");
    const filteredLogFile = join(tmpDir, "filtered.log");
    writeFileSync(filteredLogFile, "");
    // Programmatic run: the filename filter is otherwise only set from the interactive `p` prompt
    const script = join(tmpDir, "watch-filter.mjs");
    writeFileSync(
      script,
      [
        `import { createVitest } from ${JSON.stringify(import.meta.resolve("vitest/node"))};`,
        `const vitest = await createVitest("test", { watch: true });`,
        `await vitest.start();`,
        `await vitest.changeFilenamePattern("app.spec");`,
        `await vitest.waitForTestRunEnd();`,
        `console.log("ready");`,
      ].join("\n")
    );
    const child = execa(process.execPath, [script], {
      cwd: rootDir,
      env: {
        ...env,
        NITRO_TEST_WATCH_LOG: logFile,
        NITRO_TEST_WATCH_FILTERED_LOG: filteredLogFile,
      },
      extendEnv: false,
      reject: false,
      all: true,
    });
    let output = "";
    child.all?.on("data", (chunk) => (output += chunk));

    try {
      await waitFor(() => output.includes("ready"));
      expect(readFileSync(filteredLogFile, "utf8"), output).toBe("run\n");
      const appRuns = runs().length;
      writeFileSync(
        addedRouteFile,
        `import { defineHandler } from "nitro";\nexport default defineHandler(() => "added");\n`
      );
      await waitFor(() => runs().length > appRuns);
      expect(runs().at(-1), output).toMatchObject({ added: 200 });
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(readFileSync(filteredLogFile, "utf8"), output).toBe("run\n");
    } finally {
      child.kill();
      await child;
      rmSync(addedRouteFile, { force: true });
    }
  }, 120_000);
});
