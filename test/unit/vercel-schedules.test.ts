import { afterEach, describe, expect, it, vi } from "vitest";
import type { Nitro, NitroOptions } from "nitro/types";

import {
  getVercelBuildOutputSchedules,
  getVercelSchedulesMode,
  getVercelTaskSchedules,
  isVercelSchedulesEnabled,
  setupVercelSchedules,
  setupVercelSchedulesDev,
} from "../../src/presets/vercel/schedules.ts";

const task = { handler: "./task.ts" };

function options(overrides: Partial<NitroOptions> = {}): NitroOptions {
  return {
    experimental: { tasks: true },
    tasks: {},
    scheduledTasks: {},
    vercel: {},
    ...overrides,
  } as NitroOptions;
}

describe("getVercelTaskSchedules", () => {
  it("emits one schedule per task named after the task", () => {
    const schedules = getVercelTaskSchedules({
      tasks: { cleanup: task, "db:migrate": task, "reports/weekly": task },
      scheduledTasks: {
        "0 3 * * *": ["cleanup", "db:migrate"],
        "0 9 * * 1": "reports/weekly",
      },
    });
    expect(schedules).toEqual([
      { name: "cleanup", schedule: "0 3 * * *", task: "cleanup" },
      { name: "db.migrate", schedule: "0 3 * * *", task: "db:migrate" },
      { name: "reports.weekly", schedule: "0 9 * * 1", task: "reports/weekly" },
    ]);
  });

  it("suffixes tasks scheduled with several cron expressions", () => {
    const schedules = getVercelTaskSchedules({
      tasks: { cleanup: task },
      scheduledTasks: { "0 3 * * *": "cleanup", "0 15 * * *": ["cleanup", "cleanup"] },
    });
    expect(schedules.map((s) => s.name)).toEqual([
      expect.stringMatching(/^cleanup\.[\da-f]{6}$/),
      expect.stringMatching(/^cleanup\.[\da-f]{6}$/),
    ]);
    expect(new Set(schedules.map((s) => s.name)).size).toBe(2);
  });

  it("prefixes names that do not start with a letter or digit", () => {
    const [schedule] = getVercelTaskSchedules({
      tasks: { _internal: task },
      scheduledTasks: { "* * * * *": "_internal" },
    });
    expect(schedule.name).toBe("task-_internal");
  });

  it("skips undefined tasks", () => {
    expect(
      getVercelTaskSchedules({ tasks: {}, scheduledTasks: { "* * * * *": "missing" } })
    ).toEqual([]);
  });

  it("throws when two tasks map to the same schedule name", () => {
    expect(() =>
      getVercelTaskSchedules({
        tasks: { "db:migrate": task, "db.migrate": task },
        scheduledTasks: { "* * * * *": ["db:migrate", "db.migrate"] },
      })
    ).toThrow("both map to the Vercel schedule name `db.migrate`");
  });
});

describe("isVercelSchedulesEnabled", () => {
  it("requires experimental tasks", () => {
    expect(
      isVercelSchedulesEnabled(options({ experimental: {}, vercel: { schedules: true } }), {})
    ).toBe(false);
  });

  it("defaults to NITRO_VERCEL_SCHEDULES", () => {
    expect(isVercelSchedulesEnabled(options(), {})).toBe(false);
    expect(isVercelSchedulesEnabled(options(), { NITRO_VERCEL_SCHEDULES: "1" })).toBe(true);
    expect(isVercelSchedulesEnabled(options(), { NITRO_VERCEL_SCHEDULES: "false" })).toBe(false);
  });

  it("prefers the vercel.schedules option", () => {
    expect(
      isVercelSchedulesEnabled(options({ vercel: { schedules: false } }), {
        NITRO_VERCEL_SCHEDULES: "1",
      })
    ).toBe(false);
  });
});

describe("getVercelSchedulesMode", () => {
  it("uses private function targets by default", () => {
    expect(getVercelSchedulesMode(options({ vercel: { schedules: true } }), {})).toBe("function");
    expect(getVercelSchedulesMode(options(), { NITRO_VERCEL_SCHEDULES: "1" })).toBe("function");
    expect(getVercelSchedulesMode(options(), { NITRO_VERCEL_SCHEDULES: "function" })).toBe(
      "function"
    );
  });

  it("opts in to path targets", () => {
    expect(getVercelSchedulesMode(options({ vercel: { schedules: "path" } }), {})).toBe("path");
    expect(getVercelSchedulesMode(options(), { NITRO_VERCEL_SCHEDULES: "path" })).toBe("path");
  });

  it("is disabled without the opt-in", () => {
    expect(getVercelSchedulesMode(options(), {})).toBe(false);
    expect(getVercelSchedulesMode(options(), { NITRO_VERCEL_SCHEDULES: "0" })).toBe(false);
  });
});

function createNitro(
  schedules: boolean | "path" = true,
  overrides: Partial<NitroOptions> = {}
): Nitro {
  return {
    options: options({
      tasks: { cleanup: task },
      scheduledTasks: { "0 3 * * *": "cleanup" },
      vercel: { schedules },
      virtual: {},
      handlers: [],
      baseURL: "/",
      ...overrides,
    }),
    logger: { withTag: () => ({ info: vi.fn() }) },
  } as unknown as Nitro;
}

describe("getVercelBuildOutputSchedules", () => {
  it("targets the private function", () => {
    expect(getVercelBuildOutputSchedules(createNitro())).toEqual([
      { name: "cleanup", schedule: "0 3 * * *", function: "_vercel/tasks" },
    ]);
  });

  it("targets the cron handler route in path mode", () => {
    expect(getVercelBuildOutputSchedules(createNitro("path"))).toEqual([
      { name: "cleanup", schedule: "0 3 * * *", path: "/_vercel/cron" },
    ]);
    const nitro = createNitro("path", {
      vercel: { schedules: "path", cronHandlerRoute: "/api/cron" },
    });
    expect(getVercelBuildOutputSchedules(nitro)).toEqual([
      { name: "cleanup", schedule: "0 3 * * *", path: "/api/cron" },
    ]);
  });

  it("is empty without the opt-in", () => {
    expect(getVercelBuildOutputSchedules(createNitro(false))).toEqual([]);
  });
});

describe("setupVercelSchedules", () => {
  it("registers a private function with the schedule trigger", () => {
    const nitro = createNitro(true, {
      vercel: { schedules: true, functionRules: { "/_vercel/tasks": { maxDuration: 60 } } },
    });
    setupVercelSchedules(nitro);
    expect(nitro.options.handlers).toEqual([
      expect.objectContaining({
        route: "/_vercel/tasks",
        handler: "#nitro/virtual/vercel-schedule-handler",
      }),
    ]);
    expect(nitro.options.vercel!.functionRules!["/_vercel/tasks"]).toEqual({
      maxDuration: 60,
      experimentalTriggers: [{ type: "schedule/v1beta" }],
    });
    const template = nitro.options.virtual[
      "#nitro/virtual/vercel-schedule-handler"
    ] as () => string;
    expect(template()).toContain(`createScheduleHandler({"cleanup":"cleanup"})`);
  });

  it("rejects function rules with their own triggers", () => {
    const nitro = createNitro(true, {
      vercel: {
        schedules: true,
        functionRules: {
          "/_vercel/tasks": { experimentalTriggers: [{ type: "queue/v2beta", topic: "x" }] },
        },
      },
    });
    expect(() => setupVercelSchedules(nitro)).toThrow("cannot set `experimentalTriggers`");
  });

  it("serves the cron handler in path mode", () => {
    const nitro = createNitro("path");
    setupVercelSchedules(nitro);
    expect(nitro.options.handlers).toEqual([expect.objectContaining({ route: "/_vercel/cron" })]);
    expect(nitro.options.vercel!.functionRules).toBeUndefined();
  });

  it("does nothing without scheduled tasks", () => {
    const nitro = createNitro(true, { scheduledTasks: {} });
    setupVercelSchedules(nitro);
    expect(nitro.options.handlers).toEqual([]);
  });
});

describe("setupVercelSchedulesDev", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the in-process scheduler without the vercel dev broker", () => {
    vi.stubEnv("VERCEL_SCHEDULE_DEV_API_VERSION", undefined);
    const nitro = createNitro();
    setupVercelSchedulesDev(nitro);
    expect(nitro.options.scheduledTasks).toEqual({ "0 3 * * *": "cleanup" });
    expect(nitro.options.handlers).toEqual([]);
  });

  it("hands scheduling over to the vercel dev broker", async () => {
    vi.stubEnv("VERCEL_SCHEDULE_DEV_API_VERSION", "1");
    const nitro = createNitro();
    setupVercelSchedulesDev(nitro);
    expect(nitro.options.scheduledTasks).toEqual({});
    expect(nitro.options.handlers).toEqual([
      expect.objectContaining({
        route: "/_vercel/dev-manifest",
        method: "GET",
        handler: "#nitro/virtual/vercel-dev-manifest",
      }),
      expect.objectContaining({
        route: "/_vercel/tasks",
        handler: "#nitro/virtual/vercel-schedule-handler",
      }),
    ]);
    const template = nitro.options.virtual[
      "#nitro/virtual/vercel-schedule-handler"
    ] as () => string;
    expect(template()).toContain(`createScheduleHandler({"cleanup":"cleanup"})`);
  });

  it("serves the dev manifest for vercel dev", () => {
    vi.stubEnv("VERCEL_SCHEDULE_DEV_API_VERSION", "1");
    const nitro = createNitro();
    setupVercelSchedulesDev(nitro);
    const template = nitro.options.virtual["#nitro/virtual/vercel-dev-manifest"] as () => string;
    expect(template()).toContain(
      `export default () => (${JSON.stringify({
        functions: [
          {
            outputPath: "_vercel/tasks",
            invocation: { type: "http", pathname: "/_vercel/tasks" },
            experimentalTriggers: [{ type: "schedule/v1beta" }],
          },
        ],
        schedules: [{ name: "cleanup", schedule: "0 3 * * *", function: "_vercel/tasks" }],
      })});`
    );
  });

  it("serves an empty dev manifest without the opt-in", () => {
    vi.stubEnv("VERCEL_SCHEDULE_DEV_API_VERSION", "1");
    const nitro = createNitro(false);
    setupVercelSchedulesDev(nitro);
    expect(nitro.options.scheduledTasks).toEqual({ "0 3 * * *": "cleanup" });
    expect(nitro.options.handlers).toEqual([
      expect.objectContaining({ route: "/_vercel/dev-manifest" }),
    ]);
    const template = nitro.options.virtual["#nitro/virtual/vercel-dev-manifest"] as () => string;
    expect(template()).toContain(`export default () => ({"functions":[],"schedules":[]});`);
  });

  it("serves the cron handler for path targets", () => {
    vi.stubEnv("VERCEL_SCHEDULE_DEV_API_VERSION", "1");
    const nitro = createNitro("path");
    setupVercelSchedulesDev(nitro);
    expect(nitro.options.scheduledTasks).toEqual({});
    expect(nitro.options.handlers).toEqual([
      expect.objectContaining({ route: "/_vercel/dev-manifest" }),
      expect.objectContaining({ route: "/_vercel/cron" }),
    ]);
    const template = nitro.options.virtual[
      "#nitro/virtual/vercel-schedule-handler"
    ] as () => string;
    expect(template()).toContain(
      `createCronHandler([{"name":"cleanup","schedule":"0 3 * * *","task":"cleanup"}])`
    );
  });
});
