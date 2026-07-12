import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { closeHookMock, cronMock, cronStopMock } = vi.hoisted(() => {
  const cronStopMock = vi.fn();
  return {
    closeHookMock: vi.fn(),
    cronMock: vi.fn(function () {
      return { stop: cronStopMock };
    }),
    cronStopMock,
  };
});

vi.mock("croner", () => ({ Cron: cronMock }));
vi.mock("#nitro/runtime/app", () => ({
  useNitroHooks: () => ({ hook: closeHookMock }),
}));
vi.mock("#nitro/virtual/tasks", () => ({
  scheduledTasks: [
    { cron: "*/5 * * * *", tasks: ["test"] },
    { cron: "*/10 * * * *", tasks: ["test"] },
  ],
  tasks: {},
}));

import { startScheduleRunner } from "../../src/runtime/internal/task.ts";

describe("startScheduleRunner", () => {
  let testEnvironment: string | undefined;

  beforeEach(() => {
    testEnvironment = process.env.TEST;
    delete process.env.TEST;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.TEST = testEnvironment;
    vi.restoreAllMocks();
  });

  it("keeps the process alive between scheduled runs", () => {
    startScheduleRunner();

    expect(cronMock).toHaveBeenCalledWith("*/5 * * * *", expect.any(Function));
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
});
