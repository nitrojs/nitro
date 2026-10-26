import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { H3 } from "h3";

const { runTask, runCronTasks } = vi.hoisted(() => ({
  runTask: vi.fn(),
  runCronTasks: vi.fn(),
}));

vi.mock("#nitro/runtime/task", () => ({ runTask, runCronTasks }));

import { createScheduleHandler } from "../../src/presets/vercel/runtime/schedule-handler.ts";
import { createCronHandler } from "../../src/presets/vercel/runtime/cron-handler.ts";

const dispatchHeaders = (name: string): Record<string, string> => ({
  "ce-specversion": "1.0",
  "ce-type": "com.vercel.schedule.v1beta",
  "ce-source": `/schedule/default/${name}`,
  "ce-id": "execution-1",
  "ce-vssscheduleid": "schedule-1",
  "ce-vssschedulename": name,
  "ce-vssnamespace": "default",
  "ce-vssscheduledat": "2026-09-02T03:00:00.000Z",
  "ce-vssschedulesource": "static",
  "ce-vssexpression": "0 3 * * *",
});

function fetchHandler(
  handler: ReturnType<typeof createScheduleHandler>,
  init: RequestInit & { headers?: Record<string, string> } = {}
) {
  const app = new H3().all("/**", handler);
  return app.fetch(new Request("https://example.com/_vercel/tasks", init));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createScheduleHandler", () => {
  const handler = createScheduleHandler({ "db.migrate": "db:migrate" });

  it("runs the task of the schedule", async () => {
    const res = await fetchHandler(handler, {
      method: "POST",
      headers: dispatchHeaders("db.migrate"),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(runTask).toHaveBeenCalledWith("db:migrate", {
      payload: { scheduledTime: expect.any(Number) },
      context: expect.any(Object),
    });
  });

  it("accepts any request method", async () => {
    const res = await fetchHandler(handler, { headers: dispatchHeaders("db.migrate") });
    expect(res.status).toBe(200);
  });

  it("rejects requests that are not schedule dispatches", async () => {
    const headers = { ...dispatchHeaders("db.migrate"), "ce-type": "com.vercel.queue.v2beta" };
    expect((await fetchHandler(handler, { method: "POST", headers })).status).toBe(400);
    expect((await fetchHandler(handler, { method: "POST" })).status).toBe(400);
    expect(runTask).not.toHaveBeenCalled();
  });

  it("rejects dispatches with missing headers", async () => {
    const { "ce-vssexpression": _, ...headers } = dispatchHeaders("db.migrate");
    const res = await fetchHandler(handler, { method: "POST", headers });
    expect(res.status).toBe(400);
    expect(runTask).not.toHaveBeenCalled();
  });

  it("rejects unknown schedules", async () => {
    for (const name of ["unknown", "toString"]) {
      const res = await fetchHandler(handler, { method: "POST", headers: dispatchHeaders(name) });
      expect(res.status).toBe(404);
    }
    expect(runTask).not.toHaveBeenCalled();
  });
});

describe("createCronHandler", () => {
  const schedules = [
    { name: "db.migrate", schedule: "0 3 * * *", task: "db:migrate" },
    { name: "cleanup", schedule: "0 3 * * *", task: "cleanup" },
  ];

  it("runs only the task of a schedule dispatch", async () => {
    const res = await fetchHandler(createCronHandler(schedules), {
      headers: { ...dispatchHeaders("db.migrate"), "x-vercel-cron-schedule": "0 3 * * *" },
    });
    expect(res.status).toBe(200);
    expect(runTask).toHaveBeenCalledTimes(1);
    expect(runTask).toHaveBeenCalledWith("db:migrate", expect.any(Object));
  });

  it("runs the scheduled tasks of the expression for direct requests", async () => {
    const res = await fetchHandler(createCronHandler(schedules), {
      headers: { "x-vercel-cron-schedule": "0 3 * * *" },
    });
    expect(res.status).toBe(200);
    expect(runTask.mock.calls.map((c) => c[0])).toEqual(["db:migrate", "cleanup"]);
    expect(runCronTasks).not.toHaveBeenCalled();
  });

  it("runs cron tasks without schedules", async () => {
    const res = await fetchHandler(createCronHandler(), {
      headers: { ...dispatchHeaders("db.migrate"), "x-vercel-cron-schedule": "0 3 * * *" },
    });
    expect(res.status).toBe(200);
    expect(runCronTasks).toHaveBeenCalledWith("0 3 * * *", expect.any(Object));
    expect(runTask).not.toHaveBeenCalled();
  });

  it("requires the cron schedule header", async () => {
    const res = await fetchHandler(createCronHandler(schedules), {
      headers: dispatchHeaders("unknown"),
    });
    expect(res.status).toBe(400);
  });

  it("validates CRON_SECRET for schedule dispatches", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    const headers = dispatchHeaders("db.migrate");
    const handler = createCronHandler(schedules);
    expect((await fetchHandler(handler, { headers })).status).toBe(401);
    const res = await fetchHandler(handler, {
      headers: { ...headers, authorization: "Bearer secret" },
    });
    expect(res.status).toBe(200);
    expect(runTask).toHaveBeenCalledTimes(1);
  });
});
