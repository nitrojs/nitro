import { expect, it } from "vitest";
import type { BuiltFixture } from "./_build.ts";
import { startCLI, stages } from "./_run.ts";

export function lifecycleTests(getFixture: () => BuiltFixture) {
  it.each([
    ["initialization", "SIGINT", 130],
    ["initialization", "SIGTERM", 143],
    ["execution", "SIGINT", 130],
    ["execution", "SIGTERM", 143],
  ] as const)("closes once on %s %s without an IPC keepalive", async (phase, signal, code) => {
    const initializing = phase === "initialization";
    const child = await startCLI(getFixture(), ["run", initializing ? "echo:payload" : "block"], {
      ipc: false,
      env: initializing ? { TASK_CLI_INIT_WAIT: "1" } : {},
    });
    await child.waitFor(initializing ? "plugin:waiting" : "task:waiting");
    expect(child.signal(signal)).toBe(true);
    const result = await child.finished;
    expect(result.code).toBe(code);
    expect(result.signal).toBeNull();
    expect(stages(result).filter((stage) => stage === "plugin:close")).toHaveLength(1);
    expect(stages(result)).not.toContain(initializing ? "task:echo" : "task:released");
  });

  it("lets a second signal interrupt an uncooperative close hook", async () => {
    const child = await startCLI(getFixture(), ["run", "block"], {
      ipc: false,
      env: { TASK_CLI_CLOSE_WAIT: "1" },
    });
    await child.waitFor("task:waiting");
    expect(child.signal("SIGTERM")).toBe(true);
    await child.waitFor("plugin:closing");
    expect(child.signal("SIGTERM")).toBe(true);
    const result = await child.finished;
    expect(result.code).toBe(143);
    expect(result.signal).toBeNull();
    expect(stages(result).filter((stage) => stage === "plugin:close")).toHaveLength(1);
  });

  it("keeps an observed task error when a signal arrives during cleanup", async () => {
    const child = await startCLI(getFixture(), ["run", "throw"], {
      env: { TASK_CLI_CLOSE_WAIT: "1" },
    });
    await child.waitFor("plugin:closing");
    expect(child.signal("SIGINT")).toBe(true);
    await child.send("release");
    const result = await child.finished;
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("fixture task threw");
    expect(stages(result).filter((stage) => stage === "plugin:close")).toHaveLength(1);
  });

  it("keeps the signal cause when cleanup rejects the pending task", async () => {
    const child = await startCLI(getFixture(), ["run", "block"], {
      ipc: false,
      env: { TASK_CLI_CLOSE_ABORT_TASK: "1", TASK_CLI_CLOSE_REJECT: "1" },
    });
    await child.waitFor("task:waiting");
    expect(child.signal("SIGTERM")).toBe(true);
    const result = await child.finished;
    expect(result.code).toBe(143);
    expect(result.signal).toBeNull();
    expect(result.stderr).toContain("fixture cleanup rejected");
    expect(stages(result).filter((stage) => stage === "plugin:close")).toHaveLength(1);
  });

  it("cleans up on the first signal while stdout is backpressured", async () => {
    const child = await startCLI(
      getFixture(),
      ["run", "echo:payload", "--payload", '{"responseBytes":16777216}'],
      {
        ipc: false,
        pauseStdout: true,
      }
    );
    try {
      await child.waitForOutput();
      expect(child.signal("SIGTERM")).toBe(true);
      await child.waitFor("plugin:close");
    } finally {
      child.resumeOutput();
    }
    const result = await child.finished;
    expect(result.code).toBe(143);
    expect(result.signal).toBeNull();
    expect(stages(result).filter((stage) => stage === "plugin:close")).toHaveLength(1);
  });
}
