import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { closeHookMock, cronMock, cronStopMock, virtualTasks, runTaskMock } = vi.hoisted(() => {
  const cronStopMock = vi.fn();
  const runTaskMock = vi.fn();
  return {
    virtualTasks: {
      scheduleRunner: true,
      tasks: {
        test: {
          resolve: async () => ({ run: runTaskMock }),
        },
        other: {
          resolve: async () => ({ run: runTaskMock }),
        },
      } as Record<string, any>,
    },
    closeHookMock: vi.fn(),
    cronMock: vi.fn(function () {
      return { stop: cronStopMock };
    }),
    cronStopMock,
    runTaskMock,
  };
});

vi.mock("croner", () => ({ Cron: cronMock }));
vi.mock("../../src/runtime/internal/app.ts", () => ({
  useNitroApp: () => ({ ready: Promise.resolve() }),
  useNitroHooks: () => ({ hook: closeHookMock }),
}));
vi.mock("#nitro/virtual/tasks", () => ({
  scheduledTasks: [
    { cron: "*/5 * * * *", tasks: ["test"] },
    { cron: "*/10 * * * *", tasks: ["test"] },
  ],
  get scheduleRunner() {
    return virtualTasks.scheduleRunner;
  },
  get tasks() {
    return virtualTasks.tasks;
  },
}));

import { startScheduleRunner } from "../../src/runtime/internal/task.ts";
import tasksTemplate from "../../src/build/virtual/tasks.ts";

describe("startScheduleRunner", () => {
  beforeEach(() => {
    vi.stubEnv("TEST", "");
    vi.clearAllMocks();
    virtualTasks.scheduleRunner = true;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("creates a Cron job for each schedule", () => {
    startScheduleRunner();

    expect(cronMock).toHaveBeenCalledTimes(2);
    expect(cronMock).toHaveBeenCalledWith("*/5 * * * *", expect.any(Function));
    expect(cronMock).toHaveBeenCalledWith("*/10 * * * *", expect.any(Function));
  });

  it("does not schedule tasks when the schedule runner is disabled", () => {
    virtualTasks.scheduleRunner = false;
    startScheduleRunner();

    expect(cronMock).not.toHaveBeenCalled();
    expect(getHook("close")).toBeUndefined();
  });

  it("stops the schedule runner when the Nitro app closes", () => {
    startScheduleRunner();

    expect(closeHookMock).toHaveBeenCalledWith("close", expect.any(Function));

    const closeScheduleRunner = getHook("close")!;
    closeScheduleRunner();

    expect(cronStopMock).toHaveBeenCalledTimes(2);
  });

  it("continues stopping schedules when one Cron job fails to stop", () => {
    const error = new Error("stop failed");
    const firstStopMock = vi.fn(() => {
      throw error;
    });
    const secondStopMock = vi.fn();
    const consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => {});
    cronMock
      .mockImplementationOnce(function () {
        return { stop: firstStopMock };
      })
      .mockImplementationOnce(function () {
        return { stop: secondStopMock };
      });

    startScheduleRunner();
    const closeScheduleRunner = getHook("close")!;

    expect(() => closeScheduleRunner()).not.toThrow();
    expect(firstStopMock).toHaveBeenCalledOnce();
    expect(secondStopMock).toHaveBeenCalledOnce();
    expect(consoleErrorMock).toHaveBeenCalledWith("Error while stopping scheduled task", error);
  });

  it("generates a fresh payload with its own scheduledTime on each run", async () => {
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    startScheduleRunner();

    const cronCallback = (cronMock.mock.calls as any)[0][1] as () => Promise<void>;

    // First run
    await cronCallback();
    expect(runTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "test",
        payload: { scheduledTime: 1_000_000 },
      })
    );

    // Second run with updated time
    now = 2_000_000;
    await cronCallback();
    expect(runTaskMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        name: "test",
        payload: { scheduledTime: 2_000_000 },
      })
    );
  });
});

describe("shutdown hook", () => {
  beforeEach(() => {
    vi.stubEnv("TEST", "");
    vi.clearAllMocks();
    vi.resetModules();
    virtualTasks.scheduleRunner = true;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function setup() {
    const { runTask, startScheduleRunner } = await import("../../src/runtime/internal/task.ts");
    startScheduleRunner();
    const controller = new AbortController();
    const shutdown = async () => {
      const pending = new Set<Promise<unknown>>();
      getHook("shutdown")!({
        waitUntil: (promise: Promise<unknown>) => pending.add(promise),
        signal: controller.signal,
      });
      let size: number;
      do {
        size = pending.size;
        await Promise.all(pending);
      } while (pending.size !== size);
    };
    return { runTask, shutdown, abort: () => controller.abort() };
  }

  it("stops the schedules, then waits for running tasks", async () => {
    const events: string[] = [];
    const task = deferred();
    runTaskMock.mockImplementationOnce(() => task.promise.then(() => events.push("task")));
    cronStopMock.mockImplementation(() => events.push("stop"));
    const { runTask, shutdown } = await setup();

    const result = runTask("test");
    await vi.waitFor(() => expect(runTaskMock).toHaveBeenCalled());
    const done = shutdown().then(() => events.push("done"));
    await sleep();
    expect(events).toEqual(["stop", "stop"]);

    task.resolve();
    await Promise.all([done, result]);
    expect(events).toEqual(["stop", "stop", "task", "done"]);
  });

  it("waits for running tasks when the schedule runner is disabled", async () => {
    virtualTasks.scheduleRunner = false;
    const task = deferred();
    runTaskMock.mockImplementationOnce(() => task.promise);
    const { runTask, shutdown } = await setup();

    const result = runTask("test");
    let isDone = false;
    const done = shutdown().then(() => (isDone = true));
    await sleep();
    expect(isDone).toBe(false);

    task.resolve();
    await Promise.all([done, result]);
  });

  it("waits for tasks started while waiting", async () => {
    const [first, second] = [deferred(), deferred()];
    runTaskMock
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const { runTask, shutdown } = await setup();

    runTask("test");
    await vi.waitFor(() => expect(runTaskMock).toHaveBeenCalledTimes(1));
    let isDone = false;
    const done = shutdown().then(() => (isDone = true));

    runTask("other");
    await vi.waitFor(() => expect(runTaskMock).toHaveBeenCalledTimes(2));
    first.resolve();
    await sleep();
    expect(isDone).toBe(false);

    second.resolve();
    await done;
  });

  it("waits for tasks that are still loading", async () => {
    const loaded = deferred();
    const resolve = virtualTasks.tasks.test.resolve;
    virtualTasks.tasks.test.resolve = () => loaded.promise.then(resolve);
    const { runTask, shutdown } = await setup();

    try {
      const result = runTask("test");
      let isDone = false;
      const done = shutdown().then(() => (isDone = true));
      await sleep();
      expect(isDone).toBe(false);

      loaded.resolve();
      await Promise.all([done, result]);
      expect(runTaskMock).toHaveBeenCalledOnce();
    } finally {
      virtualTasks.tasks.test.resolve = resolve;
    }
  });

  it("stops waiting and reports running tasks when aborted", async () => {
    runTaskMock.mockImplementationOnce(() => new Promise(() => {}));
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { runTask, shutdown, abort } = await setup();

    runTask("test");
    await vi.waitFor(() => expect(runTaskMock).toHaveBeenCalled());
    shutdown();
    await sleep();
    expect(consoleWarn).not.toHaveBeenCalled();

    abort();
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining("`test`"));
  });
});

describe("#nitro/virtual/tasks", () => {
  const render = (options: Record<string, unknown>) =>
    tasksTemplate({
      options: {
        tasks: { test: {} },
        scheduledTasks: { "* * * * *": "test" },
        scheduler: {},
        ...options,
      },
    } as any).template();

  it("keeps the scheduled tasks when the scheduler runner is disabled", () => {
    expect(render({})).toContain("export const scheduleRunner = true;");
    const code = render({ scheduler: { runner: false } });
    expect(code).toContain("export const scheduleRunner = false;");
    expect(code).toContain(
      `export const scheduledTasks = [{"cron":"* * * * *","tasks":["test"]}];`
    );
  });
});

function getHook(name: string): ((...args: any[]) => any) | undefined {
  return closeHookMock.mock.calls.find((call) => call[0] === name)?.[1];
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

function sleep(ms = 10) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
