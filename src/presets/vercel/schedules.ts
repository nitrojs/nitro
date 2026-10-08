import type { Nitro, NitroOptions } from "nitro/types";
import { presetsDir } from "nitro/meta";
import { join } from "pathe";
import { hash } from "../../utils/hash.ts";

import type { VercelSchedule } from "./types.ts";

/** Route of the task dispatch handler and path of its private Vercel function. */
export const SCHEDULE_HANDLER_ROUTE = "/_vercel/tasks";
export const SCHEDULE_FUNCTION_PATH = "_vercel/tasks";

const SCHEDULE_HANDLER_ID = "#nitro/virtual/vercel-schedule-handler";
const SCHEDULE_TRIGGER = { type: "schedule/v1beta" } as const;

export interface VercelTaskSchedule {
  /** Vercel schedule name, derived from the task name. */
  name: string;
  /** Cron expression from `scheduledTasks`. */
  schedule: string;
  /** Nitro task name. */
  task: string;
}

/**
 * Whether scheduled tasks are emitted as Vercel Schedules instead of Cron Jobs.
 *
 * Enabled with `vercel.schedules: true` or the `NITRO_VERCEL_SCHEDULES` environment variable.
 */
export function isVercelSchedulesEnabled(
  options: NitroOptions,
  env: Record<string, string | undefined> = process.env
): boolean {
  if (!options.experimental.tasks) {
    return false;
  }
  return options.vercel?.schedules ?? isTruthyEnv(env.NITRO_VERCEL_SCHEDULES);
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

/** Build Output API `schedules` entries targeting the task dispatch function. */
export function getVercelBuildOutputSchedules(nitro: Nitro): VercelSchedule[] {
  return getVercelTaskSchedules(nitro.options).map(({ name, schedule }) => ({
    name,
    schedule,
    function: SCHEDULE_FUNCTION_PATH,
  }));
}

/**
 * Registers the private function that Vercel Schedules invokes to run scheduled tasks.
 */
export function setupVercelSchedules(nitro: Nitro) {
  if (getVercelTaskSchedules(nitro.options).length === 0) {
    return;
  }

  registerScheduleHandler(nitro, () => getVercelTaskSchedules(nitro.options));

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

/**
 * Serves the task dispatch handler in development, for the local Vercel Schedules broker
 * of `vercel dev`, which then owns task scheduling instead of the in-process scheduler.
 */
export function setupVercelSchedulesDev(nitro: Nitro) {
  if (!process.env.VERCEL_SCHEDULE_DEV_API_VERSION || !isVercelSchedulesEnabled(nitro.options)) {
    return;
  }

  const scheduledTasks = nitro.options.scheduledTasks;
  if (getVercelTaskSchedules(nitro.options, scheduledTasks).length === 0) {
    return;
  }

  registerScheduleHandler(nitro, () => getVercelTaskSchedules(nitro.options, scheduledTasks));

  // The broker invokes the handler on schedule, so the in-process scheduler must not.
  nitro.options.scheduledTasks = {};
  nitro.logger
    .withTag("vercel")
    .info("Scheduled tasks are run by the `vercel dev` Schedules broker.");
}

// --- internal ---

function registerScheduleHandler(nitro: Nitro, getSchedules: () => VercelTaskSchedule[]) {
  const handlerPath = join(presetsDir, "vercel/runtime/schedule-handler");
  nitro.options.virtual[SCHEDULE_HANDLER_ID] = () => {
    const scheduleTasks = Object.fromEntries(getSchedules().map((s) => [s.name, s.task]));
    return /* js */ `
import { createScheduleHandler } from "${handlerPath}";
export default createScheduleHandler(${JSON.stringify(scheduleTasks)});
`;
  };
  nitro.options.handlers.push({
    route: SCHEDULE_HANDLER_ROUTE,
    lazy: true,
    handler: SCHEDULE_HANDLER_ID,
  });
}

function toScheduleName(task: string): string {
  const name = task.replace(/[^\w.-]/g, ".");
  return /^[\dA-Za-z]/.test(name) ? name : `task-${name}`;
}

function isTruthyEnv(value: string | undefined): boolean {
  return !!value && value !== "0" && value.toLowerCase() !== "false";
}
