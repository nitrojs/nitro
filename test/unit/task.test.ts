import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cronMock = vi.hoisted(() => vi.fn());

vi.mock("croner", () => ({ Cron: cronMock }));
vi.mock("#nitro/virtual/tasks", () => ({
  scheduledTasks: [{ cron: "*/5 * * * *", tasks: ["test"] }],
  tasks: {},
}));

import { startScheduleRunner } from "../../src/runtime/internal/task.ts";

describe("startScheduleRunner", () => {
  let testEnvironment: string | undefined;

  beforeEach(() => {
    testEnvironment = process.env.TEST;
    delete process.env.TEST;
    cronMock.mockClear();
  });

  afterEach(() => {
    process.env.TEST = testEnvironment;
  });

  it("does not keep the process alive between scheduled runs", () => {
    startScheduleRunner();

    expect(cronMock).toHaveBeenCalledWith("*/5 * * * *", { unref: true }, expect.any(Function));
  });
});
