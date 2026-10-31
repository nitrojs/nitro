import { access } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildFixture, cleanupFixtures, type BuiltFixture } from "../task-cli/_build.ts";
import { startCLI, stages, stopChildren, type Result } from "../task-cli/_run.ts";
import { lifecycleTests } from "../task-cli/_lifecycle.ts";

describe("production task CLI", () => {
  let fixture: BuiltFixture;
  beforeAll(async () => {
    fixture = await buildFixture();
  }, 60_000);
  afterAll(async () => {
    await stopChildren();
    await cleanupFixtures();
  });

  it("transports a standalone sidecar and lists only compiled metadata", async () => {
    expect(fixture.info.taskEntry).toBe("tasks/index.mjs");
    await expect(access(fixture.entry)).resolves.toBeUndefined();
    expect(fixture.counts).toEqual({ before: 1, config: 1, compiled: 1, close: 1 });
    const result = await run(["list"], { TASK_CLI_MODULE_THROW: "1" });
    expect(result.code).toBe(0);
    expect(result.signal).toBeNull();
    expect(stages(result)).toEqual([]);
    const metadata = JSON.parse(result.stdout);
    expect(metadata).toContainEqual({
      name: "echo:payload",
      description: "Configured echo metadata",
      implemented: true,
    });
    expect(metadata).toContainEqual({
      name: "unimplemented",
      description: "No implementation",
      implemented: false,
    });
    expect(metadata).toContainEqual({ name: "constructor", implemented: true });
    expect(result.stdout).not.toContain("handler metadata must not be read by list");
  });

  it.each([
    ["help", ["--help"], 0],
    ["run help", ["run", "--help"], 0],
    ["unknown command", ["other"], 2],
    ["missing task", ["run"], 2],
    ["unknown task", ["run", "__proto__"], 2],
    ["registered reserved task", ["run", "constructor"], 2],
    ["unimplemented task", ["run", "unimplemented"], 2],
    ["invalid JSON", ["run", "echo:payload", "--payload", "{"], 2],
    ["null payload", ["run", "echo:payload", "--payload=null"], 2],
    ["array payload", ["run", "echo:payload", "--payload", "[]"], 2],
    ["missing payload", ["run", "echo:payload", "--payload"], 2],
    ["duplicate payload", ["run", "echo:payload", "--payload", "{}", "--payload={}"], 2],
    ["unexpected argument", ["run", "echo:payload", "extra"], 2],
  ] as const)("handles %s before loading user modules", async (_label, args, code) => {
    const result = await run([...args], { TASK_CLI_MODULE_THROW: "1" });
    expect(result.code).toBe(code);
    expect(result.signal).toBeNull();
    expect(stages(result)).toEqual([]);
    expect(result.stderr).not.toContain("fixture module failed");
  });

  it("waits for the plugin barrier before running and flushes a large nested result", async () => {
    const payload = {
      nested: { unicode: "一次任务", value: [1, { enabled: true }] },
      nullable: null,
      responseBytes: 256 * 1024,
    };
    const child = await startCLI(
      fixture,
      ["run", "echo:payload", "--payload", JSON.stringify(payload)],
      { env: { TASK_CLI_INIT_WAIT: "1" } }
    );
    await child.waitFor("plugin:waiting");
    await child.send("release");
    const result = await child.finished;
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      result: {
        payload,
        ready: true,
        sample: { label: "runtime 配置", nested: { enabled: true } },
        large: "x".repeat(payload.responseBytes),
      },
    });
    expect(stages(result)).toEqual([
      "plugin:module",
      "plugin:init",
      "plugin:waiting",
      "plugin:ready",
      "handler:echo",
      "task:echo",
      "plugin:close",
    ]);
  });

  it.each([
    [
      "sync initialization",
      "echo:payload",
      { TASK_CLI_INIT_THROW: "1" },
      "fixture initialization threw",
    ],
    ["async readiness", "echo:payload", { TASK_CLI_INIT_REJECT: "1" }, "fixture ready rejected"],
    ["task throw", "throw", {}, "fixture task threw"],
    ["task rejection", "reject", {}, "fixture task rejected"],
    ["result serialization", "serialize", {}, "BigInt"],
    [
      "cleanup rejection",
      "echo:payload",
      { TASK_CLI_CLOSE_REJECT: "1" },
      "fixture cleanup rejected",
    ],
  ] as const)("closes exactly once after %s fails", async (_label, task, env, error) => {
    const result = await run(["run", task], env);
    expect(result.code).toBe(1);
    expect(result.signal).toBeNull();
    expect(result.stderr).toContain(error);
    expect(stages(result).filter((stage) => stage === "plugin:init")).toHaveLength(1);
    expect(stages(result).filter((stage) => stage === "plugin:close")).toHaveLength(1);
  });

  it("preserves the task error when cleanup also rejects", async () => {
    const result = await run(["run", "throw"], { TASK_CLI_CLOSE_REJECT: "1" });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("fixture task threw");
    expect(result.stderr).toContain("fixture cleanup rejected");
    expect(stages(result).filter((stage) => stage === "plugin:close")).toHaveLength(1);
  });

  it("does not initialize again to clean up a module-evaluation error", async () => {
    const result = await run(["run", "echo:payload"], { TASK_CLI_MODULE_THROW: "1" });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("fixture module failed");
    expect(stages(result)).toEqual(["plugin:module"]);
  });

  lifecycleTests(() => fixture);

  it("isolates concurrent process payloads and cleanup", async () => {
    const results = await Promise.all(
      [1, 2].map(async (id) => run(["run", "echo:payload", "--payload", JSON.stringify({ id })]))
    );
    expect(results.map((result) => JSON.parse(result.stdout).result.payload)).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
    for (const result of results) {
      expect(result.code).toBe(0);
      expect(stages(result).filter((stage) => stage === "plugin:close")).toHaveLength(1);
    }
  });

  it("runs a task whose name only starts with a reserved name", async () => {
    const result = await run(["run", "constructor:echo", "--payload", '{"id":7}']);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).result.payload).toEqual({ id: 7 });
    expect(stages(result).filter((stage) => stage === "task:echo")).toHaveLength(1);
  });

  it("supports an empty task registry", async () => {
    const empty = await buildFixture({ empty: true });
    const child = await startCLI(empty, ["list"]);
    const result = await child.finished;
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([]);
  }, 60_000);

  async function run(args: string[], env: Record<string, string> = {}): Promise<Result> {
    const child = await startCLI(fixture, args, { env });
    return child.finished;
  }
});
