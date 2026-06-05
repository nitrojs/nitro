import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Task, TaskEvent } from "../../src/types/runtime/task.ts";
import { runTask } from "../../src/runtime/internal/task.ts";

type VirtualTask = {
  meta: NonNullable<Task["meta"]>;
  resolve?: () => Promise<Task>;
};

const mockTasks: Record<string, VirtualTask> = {};

vi.mock("#nitro/virtual/tasks", () => ({
  get tasks() {
    return mockTasks;
  },
  scheduledTasks: false,
}));

describe("task concurrency", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockTasks)) {
      delete mockTasks[key];
    }
  });

  it("dedupes concurrent calls by task name by default", async () => {
    let calls = 0;
    registerTask("default", {
      run: vi.fn(async () => {
        calls += 1;
        return { result: calls };
      }),
    });

    const results = await runMany("default", 3);
    const next = await runTask("default");

    expect(results.map((result) => result.result)).toEqual([1, 1, 1]);
    expect(next.result).toBe(2);
  });

  it("dedupes concurrent calls with the same custom key", async () => {
    const run = vi.fn(async (event: TaskEvent) => ({
      result: event.payload.userId,
    }));
    registerTask("by-user", {
      run,
      concurrency: {
        mode: "dedupe",
        key: (event) => String(event.payload.userId),
      },
    });

    const results = await Promise.all([
      runTask("by-user", { payload: { userId: "a" } }),
      runTask("by-user", { payload: { userId: "a" } }),
      runTask("by-user", { payload: { userId: "b" } }),
    ]);

    expect(run).toHaveBeenCalledTimes(2);
    expect(results.map((result) => result.result)).toEqual(["a", "a", "b"]);
  });

  it("scopes custom keys by task name", async () => {
    const concurrency = {
      mode: "dedupe" as const,
      key: () => "shared",
    };
    const runA = vi.fn(async () => ({ result: "a" }));
    const runB = vi.fn(async () => ({ result: "b" }));

    registerTask("task-a", { run: runA, concurrency });
    registerTask("task-b", { run: runB, concurrency });

    const [a, b] = await Promise.all([runTask("task-a"), runTask("task-b")]);

    expect(runA).toHaveBeenCalledTimes(1);
    expect(runB).toHaveBeenCalledTimes(1);
    expect([a.result, b.result]).toEqual(["a", "b"]);
  });

  it("passes the full task event to custom key functions", async () => {
    const key = vi.fn((event: TaskEvent) => String((event.context as { tag: string }).tag));
    registerTask("event-key", {
      run: vi.fn(async () => ({ result: "ok" })),
      concurrency: { mode: "dedupe", key },
    });

    await runTask("event-key", {
      payload: { id: 1 },
      context: { tag: "alpha" },
    });

    expect(key).toHaveBeenCalledWith({
      name: "event-key",
      payload: { id: 1 },
      context: { tag: "alpha" },
    });
  });

  it("cleans up deduped calls after rejection", async () => {
    let attempts = 0;
    registerTask("flaky", {
      run: vi.fn(async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("transient");
        }
        return { result: "ok" };
      }),
    });

    const rejected = await Promise.allSettled(callMany("flaky", 3));
    const retry = await runTask("flaky");

    expect(rejected.every((result) => result.status === "rejected")).toBe(true);
    expect(attempts).toBe(2);
    expect(retry.result).toBe("ok");
  });

  it("runs parallel tasks independently", async () => {
    let calls = 0;
    registerTask("parallel", {
      run: vi.fn(async () => {
        calls += 1;
        return { result: calls };
      }),
      concurrency: { mode: "parallel" },
    });

    const results = await runMany("parallel", 3);

    expect(new Set(results.map((result) => result.result))).toEqual(new Set([1, 2, 3]));
  });

  it("serializes calls with the same key", async () => {
    const firstRun = withResolvers();
    const events: string[] = [];

    registerTask("serial", {
      run: vi.fn(async () => {
        events.push("start");
        await firstRun.promise;
        events.push("end");
        return { result: "ok" };
      }),
      concurrency: {
        mode: "serial",
        key: () => "same",
      },
    });

    const first = runTask("serial");
    const second = runTask("serial");

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events).toEqual(["start"]);

    firstRun.resolve();
    await Promise.all([first, second]);

    expect(events).toEqual(["start", "end", "start", "end"]);
  });

  it("does not block serial calls with different keys", async () => {
    const blockedRun = withResolvers();
    const events: string[] = [];

    registerTask("serial-by-key", {
      run: vi.fn(async (event: TaskEvent) => {
        const key = String(event.payload.key);
        events.push(`start:${key}`);
        if (key === "x") {
          await blockedRun.promise;
        }
        events.push(`end:${key}`);
        return { result: key };
      }),
      concurrency: {
        mode: "serial",
        key: (event) => String(event.payload.key),
      },
    });

    const x = runTask("serial-by-key", { payload: { key: "x" } });
    const y = await runTask("serial-by-key", { payload: { key: "y" } });

    expect(y.result).toBe("y");
    expect(events).toEqual(["start:x", "start:y", "end:y"]);

    blockedRun.resolve();
    await x;

    expect(events).toEqual(["start:x", "start:y", "end:y", "end:x"]);
  });

  it("continues a serial queue after rejection", async () => {
    let attempts = 0;
    registerTask("serial-flaky", {
      run: vi.fn(async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("first failed");
        }
        return { result: "second ok" };
      }),
      concurrency: { mode: "serial" },
    });

    const results = await Promise.allSettled(callMany("serial-flaky", 2));

    expect(results[0]).toMatchObject({ status: "rejected" });
    expect(results[1]).toMatchObject({
      status: "fulfilled",
      value: { result: "second ok" },
    });
  });

  it("throws for unknown concurrency modes", async () => {
    const run = vi.fn(async () => ({ result: "should not run" }));
    registerTask("invalid-mode", {
      run,
      concurrency: { mode: "batched" } as unknown as Task["concurrency"],
    });

    await expect(runTask("invalid-mode")).rejects.toThrow(
      'Task `invalid-mode` has an invalid concurrency mode: "batched"'
    );
    expect(run).not.toHaveBeenCalled();
  });

  it("throws for unknown or unresolved tasks", async () => {
    mockTasks["no-handler"] = { meta: {} };

    await expect(runTask("missing")).rejects.toThrow("Task `missing` is not available!");
    await expect(runTask("no-handler")).rejects.toThrow("Task `no-handler` is not implemented!");
  });
});

function registerTask(name: string, task: Task) {
  mockTasks[name] = {
    meta: task.meta ?? {},
    resolve: () => Promise.resolve(task),
  };
}

function runMany(name: string, count: number) {
  return Promise.all(callMany(name, count));
}

function callMany(name: string, count: number) {
  return Array.from({ length: count }, () => runTask(name));
}

// TODO: replace with Promise.withResolvers when targeting ES2024
function withResolvers<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
