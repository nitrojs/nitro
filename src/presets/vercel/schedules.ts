import type { Nitro, NitroOptions } from "nitro/types";
import { presetsDir } from "#nitro/meta";
import { join } from "pathe";
import { joinURL, withoutLeadingSlash } from "ufo";
import { hash } from "../../utils/hash.ts";

import type { VercelSchedule, VercelServerlessFunctionConfig } from "./types.ts";

/** Route of the task dispatch handler, served by its own private Vercel function. */
export const SCHEDULE_HANDLER_ROUTE = "/_vercel/tasks";

/**
 * Set only in the environment of the private task function. The same handler is also bundled
 * into the public server function, where it must not run tasks.
 */
export const SCHEDULE_FUNCTION_ENV = "NITRO_VERCEL_SCHEDULES_FUNCTION";

const DEFAULT_CRON_HANDLER_ROUTE = "/_vercel/cron";
const SCHEDULE_HANDLER_ID = "#nitro/virtual/vercel-schedule-handler";
export const SCHEDULE_TRIGGER = { type: "schedule/v1beta" } as const;

/**
 * How Vercel Schedules invokes scheduled tasks:
 *
 * - `private`: a private function that only Vercel Schedules can invoke.
 * - `public`: the public cron handler route, like Vercel Cron Jobs.
 */
export type VercelSchedulesMode = "private" | "public";

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
 * Set with the `vercel.schedules` option, or else the `NITRO_VERCEL_SCHEDULES`
 * environment variable (`private` or `public`).
 */
export function getVercelSchedulesMode(
  options: NitroOptions,
  env: Record<string, string | undefined> = process.env
): VercelSchedulesMode | false {
  if (!options.experimental.tasks) {
    return false;
  }
  const option = options.vercel?.schedules;
  if (option !== undefined) {
    if (option === false || option === "private" || option === "public") {
      return option;
    }
    throw new Error(
      `[vercel] Invalid \`vercel.schedules\` value: ${JSON.stringify(option)}. Use "private", "public" or \`false\`.`
    );
  }
  const value = env.NITRO_VERCEL_SCHEDULES?.toLowerCase();
  if (value === "private" || value === "public") {
    return value;
  }
  if (!value || value === "0" || value === "false") {
    return false;
  }
  throw new Error(
    `[vercel] Invalid \`NITRO_VERCEL_SCHEDULES\` value: ${JSON.stringify(env.NITRO_VERCEL_SCHEDULES)}. Use "private" or "public".`
  );
}

/**
 * Maps `scheduledTasks` to one Vercel schedule per task and cron expression.
 *
 * Schedule names are the task names with characters Vercel does not allow replaced by `.`
 * (for example `db:migrate` becomes `db.migrate`). A task scheduled with several cron
 * expressions gets a stable suffix derived from each expression.
 */
export function getVercelTaskSchedules(
  options: Pick<NitroOptions, "scheduledTasks" | "tasks">
): VercelTaskSchedule[] {
  const entries: { cron: string; task: string }[] = [];
  const cronsPerTask = new Map<string, number>();
  for (const [cron, value] of Object.entries(options.scheduledTasks || {})) {
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
export function getVercelBuildOutputSchedules(nitro: Nitro): Record<string, VercelSchedule> {
  const mode = getVercelSchedulesMode(nitro.options);
  if (!mode) {
    return {};
  }
  const target =
    mode === "public"
      ? {
          path: joinURL(nitro.options.baseURL, getCronHandlerRoute(nitro)),
          requestMethod: "GET" as const,
        }
      : { function: getScheduleFunctionPath(nitro) };
  return Object.fromEntries(
    getVercelTaskSchedules(nitro.options).map(({ name, schedule }) => [
      name,
      { schedule, ...target },
    ])
  );
}

/**
 * Registers the handler that Vercel Schedules invokes to run scheduled tasks: a private
 * function in `private` mode, or the public cron handler in `public` mode.
 */
export function setupVercelSchedules(nitro: Nitro) {
  const mode = getVercelSchedulesMode(nitro.options);
  if (!mode || getVercelTaskSchedules(nitro.options).length === 0) {
    return;
  }
  if (
    mode === "private" &&
    nitro.options.vercel?.functionRules?.[SCHEDULE_HANDLER_ROUTE]?.experimentalTriggers?.length
  ) {
    throw new Error(
      `[vercel] \`vercel.functionRules["${SCHEDULE_HANDLER_ROUTE}"]\` cannot set \`experimentalTriggers\`. The scheduled tasks function only accepts the \`schedule/v1beta\` trigger.`
    );
  }
  registerScheduleHandler(nitro, mode);
}

/**
 * The private function that runs scheduled tasks in `private` mode, if any. It is written
 * without a route, so it is only reachable through Vercel Schedules' private invocation, and
 * only it has {@link SCHEDULE_FUNCTION_ENV} set. `vercel.functionRules["/_vercel/tasks"]`
 * can still configure it, for example `maxDuration`.
 */
export function getVercelScheduleFunction(
  nitro: Nitro
): { functionPath: string; overrides: VercelServerlessFunctionConfig } | undefined {
  if (
    nitro.options.static ||
    getVercelSchedulesMode(nitro.options) !== "private" ||
    getVercelTaskSchedules(nitro.options).length === 0
  ) {
    return;
  }
  const rule = nitro.options.vercel?.functionRules?.[SCHEDULE_HANDLER_ROUTE];
  return {
    functionPath: getScheduleFunctionPath(nitro),
    overrides: {
      ...rule,
      experimentalTriggers: [SCHEDULE_TRIGGER],
      environment: { ...rule?.environment, [SCHEDULE_FUNCTION_ENV]: "1" },
    },
  };
}

/**
 * Build Output API path of the private task function. It includes the `baseURL`, so the
 * request path Vercel Schedules invokes it with matches the handler route.
 */
export function getScheduleFunctionPath(nitro: Nitro): string {
  return withoutLeadingSlash(joinURL(nitro.options.baseURL, SCHEDULE_HANDLER_ROUTE));
}

export function getCronHandlerRoute(nitro: Nitro): string {
  return nitro.options.vercel?.cronHandlerRoute || DEFAULT_CRON_HANDLER_ROUTE;
}

/**
 * Serves the scheduled task handler at its route, which it returns. Only the deployed private
 * function runs tasks: in dev, the `vercel dev` Schedules broker invokes the handler directly.
 */
export function registerScheduleHandler(nitro: Nitro, mode: VercelSchedulesMode): string {
  const [file, factory, route] =
    mode === "public"
      ? ["cron-handler", "createCronHandler", getCronHandlerRoute(nitro)]
      : ["schedule-handler", "createScheduleHandler", SCHEDULE_HANDLER_ROUTE];
  const options =
    mode === "private" && !nitro.options.dev ? { functionEnv: SCHEDULE_FUNCTION_ENV } : {};
  nitro.options.virtual[SCHEDULE_HANDLER_ID] = () => {
    const scheduleTasks = Object.fromEntries(
      getVercelTaskSchedules(nitro.options).map((s) => [s.name, s.task])
    );
    return /* js */ `
import { ${factory} } from "${join(presetsDir, "vercel/runtime", file)}";
export default ${factory}(${JSON.stringify(scheduleTasks)}, ${JSON.stringify(options)});
`;
  };
  nitro.options.handlers.push({ route, lazy: true, handler: SCHEDULE_HANDLER_ID });
  return route;
}

// --- internal ---

function toScheduleName(task: string): string {
  const name = task.replace(/[^\w.-]/g, ".");
  return /^[\dA-Za-z]/.test(name) ? name : `task-${name}`;
}
