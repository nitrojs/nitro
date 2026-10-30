import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildFixture, cleanupFixtures, type BuiltFixture } from "../task-cli/_build.ts";
import { startCLI, stopChildren, type Result } from "../task-cli/_run.ts";
import { errorBytes, errorCase, expectedErrorDigest, stderrSummary } from "../task-cli/_stderr.ts";

describe("task CLI stderr backpressure", () => {
  let fixture: BuiltFixture;
  beforeAll(async () => {
    fixture = await buildFixture();
  }, 60_000);
  afterAll(async () => {
    await stopChildren();
    await cleanupFixtures();
  });

  it.each([
    ["task error", false],
    ["cleanup error", true],
  ] as const)(
    "flushes a complete large %s without a signal",
    async (_name, cleanup) => {
      const config = errorCase(cleanup);
      const child = await startCLI(fixture, ["run", config.task], { env: config.env, ipc: false });
      const result = await child.finished;
      const summary = stderrSummary(result, config.prefix);
      console.info(
        "task CLI stderr flush observation",
        JSON.stringify({ cleanup, code: result.code, signal: result.signal, ...summary })
      );
      expect(result.code).toBe(1);
      expect(result.signal).toBeNull();
      expect(summary).toEqual({
        bytes: Buffer.byteLength(config.prefix) + errorBytes + Buffer.byteLength(":end\n"),
        prefix: true,
        suffix: true,
        sha256: expectedErrorDigest(config.prefix),
        closeCount: 1,
        closeComplete: 1,
      });
    },
    10_000
  );

  it.each([
    ["task error", false],
    ["cleanup error", true],
  ] as const)(
    "exits after one signal during an already observed %s with stderr unread",
    async (_name, cleanup) => {
      const config = errorCase(cleanup);
      const child = await startCLI(fixture, ["run", config.task], {
        env: config.env,
        ipc: false,
        pauseStderr: true,
      });
      let observed: Awaited<ReturnType<typeof child.exitWithin>> | undefined;
      let forcedForBudget = false;
      let result: Result;
      try {
        await child.waitForErrorOutput();
        await child.waitFor("plugin:close:complete");
        expect(child.signal("SIGTERM")).toBe(true);
        observed = await child.exitWithin(2000);
        if (!observed.exited) forcedForBudget = child.signal("SIGKILL");
        await child.exited;
      } finally {
        child.resumeError();
        result = await child.finished;
      }
      console.info(
        "task CLI stderr signal observation",
        JSON.stringify({
          cleanup,
          observed,
          forcedForBudget,
          final: { code: result.code, signal: result.signal },
          ...stderrSummary(result, config.prefix),
        })
      );
      expect(observed).toMatchObject({ exited: true, code: 1, signal: null });
      expect(forcedForBudget).toBe(false);
      expect(result.code).toBe(1);
      expect(result.signal).toBeNull();
      expect(result.events.filter((event) => event.stage === "plugin:close")).toHaveLength(1);
    },
    10_000
  );
});
