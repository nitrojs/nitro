import type { Nitro, NitroOptions } from "nitro/types";
import type { H3Event } from "h3";
import { HTTPError } from "h3";
import { presetsDir } from "nitro/meta";
import { join } from "pathe";
import { joinURL, withoutLeadingSlash } from "ufo";
import { isLocalDevRequest } from "../../dev/_request.ts";
import { hash } from "../../utils/hash.ts";

import type {
  VercelFunctionTrigger,
  VercelSchedule,
  VercelServerlessFunctionConfig,
} from "./types.ts";

/** Route of the task dispatch handler, served by its own private Vercel function. */
export const SCHEDULE_HANDLER_ROUTE = "/_vercel/tasks";

/**
 * Set only in the environment of the private task function. The same handler is also bundled
 * into the public server function, where it must not run tasks.
 */
export const SCHEDULE_FUNCTION_ENV = "NITRO_VERCEL_SCHEDULES_FUNCTION";

const DEFAULT_CRON_HANDLER_ROUTE = "/_vercel/cron";
const SCHEDULE_HANDLER_ID = "#nitro/virtual/vercel-schedule-handler";

/** Dev-only route that `vercel dev` fetches to register the schedules with its broker. */
export const DEV_MANIFEST_ROUTE = "/_vercel/dev-manifest";
const DEV_MANIFEST_ID = "#nitro/virtual/vercel-dev-manifest";
const SCHEDULE_TRIGGER = { type: "schedule/v1beta" } as const;

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
 * Set with the `vercel.experimentalSchedules` option, or else the `NITRO_VERCEL_SCHEDULES`
 * environment variable (`private` or `public`).
 */
export function getVercelSchedulesMode(
  options: NitroOptions,
  env: Record<string, string | undefined> = process.env
): VercelSchedulesMode | false {
  if (!options.experimental.tasks) {
    return false;
  }
  const option = options.vercel?.experimentalSchedules;
  if (option !== undefined) {
    if (option === false || option === "private" || option === "public") {
      return option;
    }
    throw new Error(
      `[vercel] Invalid \`vercel.experimentalSchedules\` value: ${JSON.stringify(option)}. Use "private", "public" or \`false\`.`
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
    mode === "public"
      ? { path: joinURL(nitro.options.baseURL, getCronHandlerRoute(nitro)) }
      : { function: getScheduleFunctionPath(nitro) };
  return getVercelTaskSchedules(nitro.options, scheduledTasks).map(({ name, schedule }) => ({
    name,
    schedule,
    ...target,
  }));
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

  if (mode === "private") {
    const existingRule = nitro.options.vercel?.functionRules?.[SCHEDULE_HANDLER_ROUTE];
    if (existingRule?.experimentalTriggers?.length) {
      throw new Error(
        `[vercel] \`vercel.functionRules["${SCHEDULE_HANDLER_ROUTE}"]\` cannot set \`experimentalTriggers\`. The scheduled tasks function only accepts the \`schedule/v1beta\` trigger.`
      );
    }
  }

  registerScheduleHandler(nitro, mode, () => getVercelTaskSchedules(nitro.options), {
    requireFunctionEnv: mode === "private",
  });
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

export interface VercelDevManifest {
  /** Functions with a deployment identity, and where the dev server serves them. Empty in `public` mode. */
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
    assertLocalDevRoutes(nitro, [DEV_MANIFEST_ROUTE]);
    return;
  }

  registerScheduleHandler(nitro, mode, () => getVercelTaskSchedules(nitro.options, scheduledTasks));
  assertLocalDevRoutes(nitro, [
    DEV_MANIFEST_ROUTE,
    mode === "public" ? getCronHandlerRoute(nitro) : SCHEDULE_HANDLER_ROUTE,
  ]);

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
  if (schedules.length === 0 || getVercelSchedulesMode(nitro.options) === "public") {
    return { functions: [], schedules };
  }
  return {
    functions: [
      {
        outputPath: getScheduleFunctionPath(nitro),
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
  getSchedules: () => VercelTaskSchedule[],
  { requireFunctionEnv = false }: { requireFunctionEnv?: boolean } = {}
) {
  const [handlerPath, factory] =
    mode === "public"
      ? [join(presetsDir, "vercel/runtime/cron-handler"), "createCronHandler"]
      : [join(presetsDir, "vercel/runtime/schedule-handler"), "createScheduleHandler"];
  nitro.options.virtual[SCHEDULE_HANDLER_ID] = () => {
    const schedules = getSchedules();
    const args =
      mode === "public"
        ? [schedules]
        : [
            Object.fromEntries(schedules.map((s) => [s.name, s.task])),
            requireFunctionEnv ? { functionEnv: SCHEDULE_FUNCTION_ENV } : {},
          ];
    return /* js */ `
import { ${factory} } from "${handlerPath}";
export default ${factory}(${args.map((arg) => JSON.stringify(arg)).join(", ")});
`;
  };
  nitro.options.handlers.push({
    route: mode === "public" ? getCronHandlerRoute(nitro) : SCHEDULE_HANDLER_ROUTE,
    lazy: true,
    handler: SCHEDULE_HANDLER_ID,
  });
}

function registerDevManifest(nitro: Nitro, getManifest: () => VercelDevManifest) {
  nitro.options.virtual[DEV_MANIFEST_ID] = () =>
    /* js */ `export default () => (${JSON.stringify(getManifest())});`;
  nitro.options.handlers.push({
    route: DEV_MANIFEST_ROUTE,
    method: "GET",
    lazy: true,
    handler: DEV_MANIFEST_ID,
  });
}

/**
 * Rejects non-local requests to the dev-only routes before they reach the worker, like the
 * `/_nitro/tasks` routes: the dev server binds all interfaces by default.
 */
function assertLocalDevRoutes(nitro: Nitro, routes: string[]) {
  const assertLocal = (event: H3Event) => {
    if (!isLocalDevRequest(event)) {
      throw new HTTPError({ statusText: "Forbidden IP", status: 403 });
    }
  };
  for (const route of routes) {
    for (const pattern of [route, joinURL(route, "**")]) {
      nitro.options.devHandlers.push({
        route: joinURL(nitro.options.baseURL, pattern),
        middleware: true,
        handler: assertLocal,
      });
    }
  }
}

function toScheduleName(task: string): string {
  const name = task.replace(/[^\w.-]/g, ".");
  return /^[\dA-Za-z]/.test(name) ? name : `task-${name}`;
}
