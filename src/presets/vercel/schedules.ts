import type { Nitro, NitroOptions } from "nitro/types";
import { presetsDir } from "nitro/meta";
import { join } from "pathe";
import { joinURL } from "ufo";
import { hash } from "../../utils/hash.ts";

import type { VercelFunctionTrigger, VercelSchedule } from "./types.ts";

/** Route of the task dispatch handler and path of its private Vercel function. */
export const SCHEDULE_HANDLER_ROUTE = "/_vercel/tasks";
export const SCHEDULE_FUNCTION_PATH = "_vercel/tasks";

const DEFAULT_CRON_HANDLER_ROUTE = "/_vercel/cron";
const SCHEDULE_HANDLER_ID = "#nitro/virtual/vercel-schedule-handler";

/** Dev-only route that `vercel dev` fetches to register the schedules with its broker. */
export const DEV_MANIFEST_ROUTE = "/_vercel/dev-manifest";
const DEV_MANIFEST_ID = "#nitro/virtual/vercel-dev-manifest";
const SCHEDULE_TRIGGER = { type: "schedule/v1beta" } as const;

/**
 * How Vercel Schedules invokes scheduled tasks:
 *
 * - `function`: a private function that only Vercel Schedules can invoke.
 * - `path`: the public cron handler route, like Vercel Cron Jobs.
 */
export type VercelSchedulesMode = "function" | "path";

export interface VercelTaskSchedule {
  /** Vercel schedule name, derived from the task name. */
  name: string;
  /** Cron expression from `scheduledTasks`. */
  schedule: string;
  /** Nitro task name. */
  task: string;
}

/**
 * Whether and how scheduled tasks are emitted as Vercel Schedules instead of Cron Jobs.
 *
 * Set with the `vercel.schedules` option, or else the `NITRO_VERCEL_SCHEDULES` environment
 * variable: `true`/`1`/`function` for private function targets, `path` for the public
 * cron handler route.
 */
export function getVercelSchedulesMode(
  options: NitroOptions,
  env: Record<string, string | undefined> = process.env
): VercelSchedulesMode | false {
  if (!options.experimental.tasks) {
    return false;
  }
  const value = options.vercel?.schedules ?? env.NITRO_VERCEL_SCHEDULES;
  if (value === "path") {
    return "path";
  }
  if (typeof value === "string") {
    return ["", "0", "false"].includes(value.toLowerCase()) ? false : "function";
  }
  return value ? "function" : false;
}

export function isVercelSchedulesEnabled(
  options: NitroOptions,
  env: Record<string, string | undefined> = process.env
): boolean {
  return getVercelSchedulesMode(options, env) !== false;
}

/**
 * Maps `scheduledTasks` to one Vercel schedule per task and cron expression.
 *
 * Schedule names are the task names with characters Vercel does not allow replaced by `.`
 * (for example `db:migrate` becomes `db.migrate`). A task scheduled with several cron
 * expressions gets a stable suffix derived from each expression.
 */
export function getVercelTaskSchedules(
  options: Pick<NitroOptions, "scheduledTasks" | "tasks">,
  scheduledTasks = options.scheduledTasks
): VercelTaskSchedule[] {
  const entries: { cron: string; task: string }[] = [];
  const cronsPerTask = new Map<string, number>();
  for (const [cron, value] of Object.entries(scheduledTasks || {})) {
    for (const task of new Set(Array.isArray(value) ? value : [value])) {
      if (!options.tasks[task]) {
        continue;
      }
      entries.push({ cron, task });
      cronsPerTask.set(task, (cronsPerTask.get(task) || 0) + 1);
    }
  }

  const tasksByName = new Map<string, string>();
  return entries.map(({ cron, task }) => {
    let name = toScheduleName(task);
    if (cronsPerTask.get(task)! > 1) {
      name = `${name}.${hash(cron, 6)}`;
    }
    const existing = tasksByName.get(name);
    if (existing !== undefined) {
      throw new Error(
        `[vercel] Scheduled tasks \`${existing}\` and \`${task}\` both map to the Vercel schedule name \`${name}\`. Rename one of the tasks.`
      );
    }
    tasksByName.set(name, task);
    return { name, schedule: cron, task };
  });
}

/** Build Output API `schedules` entries for the scheduled tasks. */
export function getVercelBuildOutputSchedules(
  nitro: Nitro,
  scheduledTasks = nitro.options.scheduledTasks
): VercelSchedule[] {
  const mode = getVercelSchedulesMode(nitro.options);
  if (!mode) {
    return [];
  }
  const target =
    mode === "path" ? { path: getCronHandlerRoute(nitro) } : { function: SCHEDULE_FUNCTION_PATH };
  return getVercelTaskSchedules(nitro.options, scheduledTasks).map(({ name, schedule }) => ({
    name,
    schedule,
    ...target,
  }));
}

/**
 * Registers the handler that Vercel Schedules invokes to run scheduled tasks: a private
 * function in `function` mode, or the public cron handler in `path` mode.
 */
export function setupVercelSchedules(nitro: Nitro) {
  const mode = getVercelSchedulesMode(nitro.options);
  if (!mode || getVercelTaskSchedules(nitro.options).length === 0) {
    return;
  }

  registerScheduleHandler(nitro, mode, () => getVercelTaskSchedules(nitro.options));
  if (mode === "path") {
    return;
  }

  nitro.options.vercel ??= {};
  nitro.options.vercel.functionRules ??= {};
  const existingRule = nitro.options.vercel.functionRules[SCHEDULE_HANDLER_ROUTE];
  if (existingRule?.experimentalTriggers?.length) {
    throw new Error(
      `[vercel] \`vercel.functionRules["${SCHEDULE_HANDLER_ROUTE}"]\` cannot set \`experimentalTriggers\`. The scheduled tasks function only accepts the \`schedule/v1beta\` trigger.`
    );
  }
  nitro.options.vercel.functionRules[SCHEDULE_HANDLER_ROUTE] = {
    ...existingRule,
    experimentalTriggers: [SCHEDULE_TRIGGER],
  };
}

export interface VercelDevManifest {
  /** Functions with a deployment identity, and where the dev server serves them. Empty in `path` mode. */
  functions: {
    /** Build Output API function path, without a leading slash or `.func` suffix. */
    outputPath: string;
    invocation: { type: "http"; pathname: string };
    experimentalTriggers: VercelFunctionTrigger[];
  }[];
  /** Build Output API `schedules`, as emitted by `nitro build`. */
  schedules: VercelSchedule[];
}

/**
 * Under `vercel dev`, serves the dev manifest that `vercel dev` fetches to register the
 * scheduled tasks with its local Schedules broker, and the handler the broker invokes. The
 * broker then owns task scheduling instead of the in-process scheduler.
 */
export function setupVercelSchedulesDev(nitro: Nitro) {
  if (!process.env.VERCEL_SCHEDULE_DEV_API_VERSION) {
    return;
  }

  const mode = getVercelSchedulesMode(nitro.options);
  const scheduledTasks = nitro.options.scheduledTasks;
  registerDevManifest(nitro, () => getVercelDevManifest(nitro, scheduledTasks));
  if (!mode) {
    return;
  }

  registerScheduleHandler(nitro, mode, () => getVercelTaskSchedules(nitro.options, scheduledTasks));

  // The broker invokes the handler on schedule, so the in-process scheduler must not.
  nitro.options.scheduledTasks = {};
  nitro.logger
    .withTag("vercel")
    .info("Scheduled tasks are run by the `vercel dev` Schedules broker.");
}

/** The functions and schedules that `vercel dev` registers with its local Schedules broker. */
export function getVercelDevManifest(
  nitro: Nitro,
  scheduledTasks = nitro.options.scheduledTasks
): VercelDevManifest {
  const schedules = getVercelBuildOutputSchedules(nitro, scheduledTasks);
  if (schedules.length === 0 || getVercelSchedulesMode(nitro.options) === "path") {
    return { functions: [], schedules };
  }
  return {
    functions: [
      {
        outputPath: SCHEDULE_FUNCTION_PATH,
        invocation: {
          type: "http",
          pathname: joinURL(nitro.options.baseURL, SCHEDULE_HANDLER_ROUTE),
        },
        experimentalTriggers: [SCHEDULE_TRIGGER],
      },
    ],
    schedules,
  };
}

export function getCronHandlerRoute(nitro: Nitro): string {
  return nitro.options.vercel?.cronHandlerRoute || DEFAULT_CRON_HANDLER_ROUTE;
}

// --- internal ---

function registerScheduleHandler(
  nitro: Nitro,
  mode: VercelSchedulesMode,
  getSchedules: () => VercelTaskSchedule[]
) {
  const [handlerPath, factory] =
    mode === "path"
      ? [join(presetsDir, "vercel/runtime/cron-handler"), "createCronHandler"]
      : [join(presetsDir, "vercel/runtime/schedule-handler"), "createScheduleHandler"];
  nitro.options.virtual[SCHEDULE_HANDLER_ID] = () => {
    const schedules = getSchedules();
    const arg =
      mode === "path" ? schedules : Object.fromEntries(schedules.map((s) => [s.name, s.task]));
    return /* js */ `
import { ${factory} } from "${handlerPath}";
export default ${factory}(${JSON.stringify(arg)});
`;
  };
  nitro.options.handlers.push({
    route: mode === "path" ? getCronHandlerRoute(nitro) : SCHEDULE_HANDLER_ROUTE,
    lazy: true,
    handler: SCHEDULE_HANDLER_ID,
  });
}

function registerDevManifest(nitro: Nitro, getManifest: () => VercelDevManifest) {
  const handlerPath = join(presetsDir, "vercel/runtime/dev-manifest-handler");
  nitro.options.virtual[DEV_MANIFEST_ID] = () => /* js */ `
import { createDevManifestHandler } from "${handlerPath}";
export default createDevManifestHandler(${JSON.stringify(getManifest())});
`;
  nitro.options.handlers.push({
    route: DEV_MANIFEST_ROUTE,
    method: "GET",
    lazy: true,
    handler: DEV_MANIFEST_ID,
  });
}

function toScheduleName(task: string): string {
  const name = task.replace(/[^\w.-]/g, ".");
  return /^[\dA-Za-z]/.test(name) ? name : `task-${name}`;
}
