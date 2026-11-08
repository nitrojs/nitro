import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { closeHookMock, cronMock, cronStopMock, virtualTasks } = vi.hoisted(() => {
  const cronStopMock = vi.fn();
  return {
    virtualTasks: { scheduleRunner: true, tasks: {} as Record<string, any> },
    closeHookMock: vi.fn(),
    cronMock: vi.fn(function () {
      return { stop: cronStopMock };
    }),
    cronStopMock,
  };
});

vi.mock("croner", () => ({ Cron: cronMock }));
vi.mock("../../src/runtime/internal/app.ts", () => ({
  useNitroHooks: () => ({ hook: closeHookMock }),
  useNitroApp: () => ({ ready: Promise.resolve() }),
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

import {
  _resetTasksState,
  runTask,
  startScheduleRunner,
  waitForRunningTasks,
} from "../../src/runtime/internal/task.ts";
import tasksTemplate from "../../src/build/virtual/tasks.ts";

describe("startScheduleRunner", () => {
  beforeEach(() => {
    vi.stubEnv("TEST", "");
    vi.clearAllMocks();
    _resetTasksState();
    virtualTasks.scheduleRunner = true;
    virtualTasks.tasks = {};
  });

  afterEach(() => {
    _resetTasksState();
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
    expect(closeHookMock).not.toHaveBeenCalled();
  });

  it("stops the schedule runner when the Nitro app closes", () => {
    startScheduleRunner();

    expect(closeHookMock).toHaveBeenCalledWith("close", expect.any(Function));

    const closeScheduleRunner = closeHookMock.mock.calls[0]![1];
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
    const closeScheduleRunner = closeHookMock.mock.calls[0]![1];

    expect(() => closeScheduleRunner()).not.toThrow();
    expect(firstStopMock).toHaveBeenCalledOnce();
    expect(secondStopMock).toHaveBeenCalledOnce();
    expect(consoleErrorMock).toHaveBeenCalledWith("Error while stopping scheduled task", error);
  });

  it("awaits running tasks on close", async () => {
    let taskCompleted = false;
    virtualTasks.tasks = {
      test: {
        resolve: async () => ({
          run: async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
            taskCompleted = true;
            return { result: "ok" };
          },
        }),
      },
    };

    startScheduleRunner();
    const taskPromise = runTask("test");

    const closeScheduleRunner = closeHookMock.mock.calls[0]![1];
    expect(taskCompleted).toBe(false);

    await closeScheduleRunner();
    expect(taskCompleted).toBe(true);
    await taskPromise;
  });

  it("rejects new runTask calls once shutdown has started", async () => {
    startScheduleRunner();
    const closeScheduleRunner = closeHookMock.mock.calls[0]![1];
    await closeScheduleRunner();

    await expect(runTask("any")).rejects.toThrow("Server is shutting down");
  });

  it("bounds the wait by the shutdown timeout if a task is stuck", async () => {
    virtualTasks.tasks = {
      stuck: {
        resolve: async () => ({
          run: () => new Promise(() => {}),
        }),
      },
    };

    runTask("stuck");
    const start = Date.now();
    await waitForRunningTasks(50);
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(40);
    expect(duration).toBeLessThan(500);
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
