import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isWindows } from "std-env";
import { buildFixture, cleanupFixtures, type BuiltFixture } from "../task-cli/_build.ts";
import { errorCase } from "../task-cli/_stderr.ts";
import { startCLI, stages, stopChildren, type Result } from "../task-cli/_run.ts";

const builders = [
  ["rollup", false],
  ["rolldown", false],
  ["vite", true],
  ["vite", false],
] as const;

type CLIChild = Awaited<ReturnType<typeof startCLI>>;

describe.skipIf(isWindows).each(builders)(
  "task CLI pipe and signal boundaries (%s, Vite7=%s)",
  (builder, vite7) => {
    let fixture: BuiltFixture;
    beforeAll(async () => {
      fixture = await buildFixture({ builder, vite7, boundary: true });
    }, 60_000);
    afterAll(async () => {
      await stopChildren();
      await cleanupFixtures();
    });

    it("exits on the first signal while stdout remains unread", async () => {
      const child = await startCLI(
        fixture,
        ["run", "echo:payload", "--payload", '{"responseBytes":16777216}'],
        { ipc: false, pauseStdout: true }
      );
      const observation = await observeBoundaryExit(child, async () => {
        await child.waitForOutput();
        expect(child.signal("SIGTERM")).toBe(true);
        await child.waitFor("plugin:close");
      });
      expectExit(observation, 143, "stdout unread");
      expectCloseOnce(observation.result);
    });

    it("cleans up after a real stdout EPIPE", async () => {
      const child = await startCLI(
        fixture,
        ["run", "echo:payload", "--payload", '{"responseBytes":16777216}'],
        { ipc: false, pauseStdout: true, epipeProbe: true }
      );
      const observation = await observeBoundaryExit(child, async () => {
        await child.waitForOutput();
        child.closeOutput();
      });
      expectExit(observation, 1, "stdout EPIPE");
      expect(stages(observation.result)).toContain("io:stdout:EPIPE");
      expectCloseOnce(observation.result);
    });

    it.each([
      ["task error", false],
      ["cleanup error", true],
    ] as const)(
      "preserves failure status for %s after a real stderr EPIPE",
      async (_name, cleanup) => {
        const config = errorCase(cleanup);
        const child = await startCLI(fixture, ["run", config.task], {
          env: config.env,
          ipc: false,
          pauseStderr: true,
          epipeProbe: true,
        });
        const observation = await observeBoundaryExit(child, async () => {
          await child.waitForErrorOutput();
          await child.waitFor("plugin:close:complete");
          child.closeError();
        });
        expectExit(observation, 1, `stderr EPIPE (${_name})`);
        expect(stages(observation.result)).toContain("io:stderr:EPIPE");
        expectCloseOnce(observation.result);
        expect(
          stages(observation.result).filter((stage) => stage === "plugin:close:complete")
        ).toHaveLength(1);
      }
    );

    it.each([
      ["SIGINT", 130],
      ["SIGTERM", 143],
    ] as const)(
      "interrupts runner module TLA on %s before app initialization",
      async (signal, code) => {
        const child = await startCLI(fixture, ["run", "echo:payload"], {
          env: { TASK_CLI_TLA_WAIT: "1" },
          ipc: false,
        });
        const observation = await observeBoundaryExit(child, async () => {
          await child.waitFor("boundary:tla:waiting");
          expect(child.signal(signal)).toBe(true);
        });
        expectExit(observation, code, `runner TLA (${signal})`);
        for (const stage of [
          "boundary:tla:released",
          "boundary:init",
          "plugin:init",
          "plugin:close",
          "task:echo",
        ]) {
          expect(stages(observation.result)).not.toContain(stage);
        }
      }
    );

    it("retains an observed task failure when the second signal forces exit", async () => {
      const child = await startCLI(fixture, ["run", "throw"], {
        env: { TASK_CLI_CLOSE_WAIT: "1" },
        ipc: false,
      });
      const observation = await observeBoundaryExit(child, async () => {
        await child.waitFor("plugin:closing");
        expect(child.signal("SIGINT")).toBe(true);
        await child.waitFor("boundary:SIGINT");
        const afterFirstSignal = await child.exitWithin(100);
        console.info(
          "task CLI first signal observation",
          JSON.stringify({ builder, vite7, afterFirstSignal })
        );
        expect(afterFirstSignal).toMatchObject({ exited: false, code: null, signal: null });
        expect(child.signal("SIGTERM")).toBe(true);
      });
      expectExit(observation, 1, "error-first second signal");
      expect(stages(observation.result)).toContain("task:throw");
      expectCloseOnce(observation.result);
    });
  }
);

async function observeBoundaryExit(child: CLIChild, trigger: () => Promise<void>) {
  let observed: Awaited<ReturnType<CLIChild["exitWithin"]>> | undefined;
  let forcedForBudget = false;
  let result!: Result;
  try {
    await trigger();
    observed = await child.exitWithin(2000);
  } finally {
    if (!observed?.exited) forcedForBudget = child.signal("SIGKILL");
    await child.exited;
    child.resumeOutput();
    child.resumeError();
    result = await child.finished;
  }
  return { observed, forcedForBudget, result };
}

function expectExit(
  observation: Awaited<ReturnType<typeof observeBoundaryExit>>,
  code: number,
  name: string
) {
  const { observed, forcedForBudget, result } = observation;
  console.info(
    "task CLI boundary exit observation",
    JSON.stringify({
      name,
      observed,
      forcedForBudget,
      final: { code: result.code, signal: result.signal },
    })
  );
  expect(observed).toMatchObject({ exited: true, code, signal: null });
  expect(forcedForBudget).toBe(false);
  expect(result.code).toBe(code);
  expect(result.signal).toBeNull();
}

function expectCloseOnce(result: Result) {
  expect(stages(result).filter((stage) => stage === "plugin:close")).toHaveLength(1);
}
