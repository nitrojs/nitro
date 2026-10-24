import { afterEach, describe, expect, it, vi } from "vitest";
import type { Nitro, NitroOptions } from "nitro/types";

import {
  getVercelBuildOutputSchedules,
  getVercelScheduleFunction,
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
      isVercelSchedulesEnabled(
        options({ experimental: {}, vercel: { experimentalSchedules: "private" } }),
        {}
      )
    ).toBe(false);
  });

  it("defaults to NITRO_VERCEL_SCHEDULES", () => {
    expect(isVercelSchedulesEnabled(options(), {})).toBe(false);
    expect(isVercelSchedulesEnabled(options(), { NITRO_VERCEL_SCHEDULES: "private" })).toBe(true);
    expect(isVercelSchedulesEnabled(options(), { NITRO_VERCEL_SCHEDULES: "false" })).toBe(false);
  });

  it("prefers the vercel.experimentalSchedules option", () => {
    expect(
      isVercelSchedulesEnabled(options({ vercel: { experimentalSchedules: false } }), {
        NITRO_VERCEL_SCHEDULES: "private",
      })
    ).toBe(false);
  });
});

describe("getVercelSchedulesMode", () => {
  it("uses private function targets", () => {
    expect(
      getVercelSchedulesMode(options({ vercel: { experimentalSchedules: "private" } }), {})
    ).toBe("private");
    expect(getVercelSchedulesMode(options(), { NITRO_VERCEL_SCHEDULES: "private" })).toBe(
      "private"
    );
  });

  it("uses public path targets", () => {
    expect(
      getVercelSchedulesMode(options({ vercel: { experimentalSchedules: "public" } }), {})
    ).toBe("public");
    expect(getVercelSchedulesMode(options(), { NITRO_VERCEL_SCHEDULES: "PUBLIC" })).toBe("public");
  });

  it("is disabled without the opt-in", () => {
    expect(getVercelSchedulesMode(options(), {})).toBe(false);
    expect(getVercelSchedulesMode(options(), { NITRO_VERCEL_SCHEDULES: "0" })).toBe(false);
  });

  it("rejects invalid values", () => {
    const invalid = options({ vercel: { experimentalSchedules: true as unknown as "private" } });
    expect(() => getVercelSchedulesMode(invalid, {})).toThrow(
      "Invalid `vercel.experimentalSchedules` value: true"
    );
    expect(() => getVercelSchedulesMode(options(), { NITRO_VERCEL_SCHEDULES: "1" })).toThrow(
      'Invalid `NITRO_VERCEL_SCHEDULES` value: "1"'
    );
  });
});

function createNitro(
  schedules: "private" | "public" | false = "private",
  overrides: Partial<NitroOptions> = {}
): Nitro {
  return {
    options: options({
      tasks: { cleanup: task },
      scheduledTasks: { "0 3 * * *": "cleanup" },
      vercel: { experimentalSchedules: schedules },
      virtual: {},
      handlers: [],
      devHandlers: [],
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
    expect(getVercelBuildOutputSchedules(createNitro("public"))).toEqual([
      { name: "cleanup", schedule: "0 3 * * *", path: "/_vercel/cron" },
    ]);
    const nitro = createNitro("public", {
      vercel: { experimentalSchedules: "public", cronHandlerRoute: "/api/cron" },
    });
    expect(getVercelBuildOutputSchedules(nitro)).toEqual([
      { name: "cleanup", schedule: "0 3 * * *", path: "/api/cron" },
    ]);
  });

  it("is empty without the opt-in", () => {
    expect(getVercelBuildOutputSchedules(createNitro(false))).toEqual([]);
  });

  it("includes the baseURL in function and path targets", () => {
    expect(getVercelBuildOutputSchedules(createNitro("private", { baseURL: "/app/" }))).toEqual([
      { name: "cleanup", schedule: "0 3 * * *", function: "app/_vercel/tasks" },
    ]);
    expect(getVercelBuildOutputSchedules(createNitro("public", { baseURL: "/app/" }))).toEqual([
      { name: "cleanup", schedule: "0 3 * * *", path: "/app/_vercel/cron" },
    ]);
  });
});

describe("getVercelScheduleFunction", () => {
  it("describes the private function, with only it allowed to run tasks", () => {
    const nitro = createNitro("private", {
      vercel: {
        experimentalSchedules: "private",
        functionRules: { "/_vercel/tasks": { maxDuration: 60, environment: { FOO: "bar" } } },
      },
    });
    expect(getVercelScheduleFunction(nitro)).toEqual({
      functionPath: "_vercel/tasks",
      overrides: {
        maxDuration: 60,
        experimentalTriggers: [{ type: "schedule/v1beta" }],
        environment: { FOO: "bar", NITRO_VERCEL_SCHEDULES_FUNCTION: "1" },
      },
    });
  });

  it("is undefined in path mode, without the opt-in, or without scheduled tasks", () => {
    expect(getVercelScheduleFunction(createNitro("public"))).toBeUndefined();
    expect(getVercelScheduleFunction(createNitro(false))).toBeUndefined();
    expect(
      getVercelScheduleFunction(createNitro("private", { scheduledTasks: {} }))
    ).toBeUndefined();
  });
});

describe("setupVercelSchedules", () => {
  it("registers a private function with the schedule trigger", () => {
    const nitro = createNitro("private", {
      vercel: {
        experimentalSchedules: "private",
        functionRules: { "/_vercel/tasks": { maxDuration: 60 } },
      },
    });
    setupVercelSchedules(nitro);
    expect(nitro.options.handlers).toEqual([
      expect.objectContaining({
        route: "/_vercel/tasks",
        handler: "#nitro/virtual/vercel-schedule-handler",
      }),
    ]);
    // The private function is written without a public route, not through `functionRules`
    expect(nitro.options.vercel!.functionRules!["/_vercel/tasks"]).toEqual({ maxDuration: 60 });
    const template = nitro.options.virtual[
      "#nitro/virtual/vercel-schedule-handler"
    ] as () => string;
    expect(template()).toContain(
      `createScheduleHandler({"cleanup":"cleanup"}, {"functionEnv":"NITRO_VERCEL_SCHEDULES_FUNCTION"})`
    );
  });

  it("rejects function rules with their own triggers", () => {
    const nitro = createNitro("private", {
      vercel: {
        experimentalSchedules: "private",
        functionRules: {
          "/_vercel/tasks": { experimentalTriggers: [{ type: "queue/v2beta", topic: "x" }] },
        },
      },
    });
    expect(() => setupVercelSchedules(nitro)).toThrow("cannot set `experimentalTriggers`");
  });

  it("serves the cron handler in path mode", () => {
    const nitro = createNitro("public");
    setupVercelSchedules(nitro);
    expect(nitro.options.handlers).toEqual([expect.objectContaining({ route: "/_vercel/cron" })]);
    expect(nitro.options.vercel!.functionRules).toBeUndefined();
  });

  it("does nothing without scheduled tasks", () => {
    const nitro = createNitro("private", { scheduledTasks: {} });
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
    expect(template()).toContain(`createScheduleHandler({"cleanup":"cleanup"}, {})`);
  });

  it("restricts the dev routes to local requests", () => {
    vi.stubEnv("VERCEL_SCHEDULE_DEV_API_VERSION", "1");
    const nitro = createNitro("private", { baseURL: "/app/" });
    setupVercelSchedulesDev(nitro);
    expect(nitro.options.devHandlers.map((h) => [h.route, h.middleware])).toEqual([
      ["/app/_vercel/dev-manifest", true],
      ["/app/_vercel/dev-manifest/**", true],
      ["/app/_vercel/tasks", true],
      ["/app/_vercel/tasks/**", true],
    ]);
    const assertLocal = nitro.options.devHandlers[0].handler as (event: unknown) => void;
    const event = (ip: string) => ({
      req: Object.assign(new Request("http://localhost/app/_vercel/tasks"), { ip }),
      runtime: { node: { req: { socket: { remoteAddress: ip } } } },
    });
    expect(() => assertLocal(event("127.0.0.1"))).not.toThrow();
    expect(() => assertLocal(event("192.168.1.20"))).toThrow("Forbidden IP");
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
    const nitro = createNitro("public");
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
    expect(nitro.options.devHandlers.map((h) => h.route)).toContain("/_vercel/cron");
  });
});
