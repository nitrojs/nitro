import { Cron } from "croner";
import { HTTPError } from "h3";
import type {
  NitroShutdownContext,
  Task,
  TaskContext,
  TaskEvent,
  TaskPayload,
  TaskResult,
} from "nitro/types";
import { useNitroApp, useNitroHooks } from "./app.ts";
import { scheduledTasks, scheduleRunner, tasks } from "#nitro/virtual/tasks";

/** @experimental */
export function defineTask<RT = unknown>(def: Task<RT>): Task<RT> {
  if (typeof def.run !== "function") {
    def.run = () => {
      throw new TypeError("Task must implement a `run` method!");
    };
  }
  return def;
}

const __runningTasks__: { [name: string]: Promise<TaskResult<any>> | undefined } = {};
let __shutdownWaitUntil__: NitroShutdownContext["waitUntil"] | undefined;

/** @experimental */
export async function runTask<RT = unknown>(
  name: string,
  { payload = {}, context = {} }: { payload?: TaskPayload; context?: TaskContext } = {}
): Promise<TaskResult<RT>> {
  if (__runningTasks__[name]) {
    return __runningTasks__[name];
  }

  if (!(name in tasks)) {
    throw new HTTPError({
      message: `Task \`${name}\` is not available!`,
      status: 404,
    });
  }

  if (!tasks[name].resolve) {
    throw new HTTPError({
      message: `Task \`${name}\` is not implemented!`,
      status: 501,
    });
  }

  const taskEvent: TaskEvent = { name, payload, context };
  const running = tasks[name].resolve().then((handler) => (handler as Task<RT>).run(taskEvent));
  __runningTasks__[name] = running;
  __shutdownWaitUntil__?.(running.catch(() => {}));

  try {
    return await running;
  } finally {
    delete __runningTasks__[name];
  }
}

/** @experimental */
export function startScheduleRunner({
  waitUntil,
}: {
  waitUntil?: ((promise: Promise<unknown>) => void) | undefined;
} = {}): void {
  const cronJobs: Cron[] = [];
  useNitroHooks().hook("shutdown", ({ waitUntil, signal }) => {
    stopCronJobs(cronJobs);
    __shutdownWaitUntil__ = waitUntil;
    waitUntil(Promise.allSettled(Object.values(__runningTasks__)));
    signal.addEventListener("abort", warnRunningTasks, { once: true });
  });

  if (!scheduleRunner || !scheduledTasks || scheduledTasks.length === 0 || process.env.TEST) {
    return;
  }

  useNitroHooks().hook("close", () => stopCronJobs(cronJobs));

  for (const schedule of scheduledTasks) {
    cronJobs.push(
      new Cron(schedule.cron, async () => {
        try {
          await useNitroApp().ready;
        } catch {
          // Plugin initialization failed and was already reported
          return;
        }
        const payload: TaskPayload = {
          scheduledTime: Date.now(),
        };
        await Promise.all(
          schedule.tasks.map((name) =>
            runTask(name, {
              payload,
              context: { waitUntil },
            }).catch((error) => {
              console.error(`Error while running scheduled task "${name}"`, error);
            })
          )
        );
      })
    );
  }
}

/** @experimental */
export function getCronTasks(cron: string): string[] {
  return (scheduledTasks || []).find((task) => task.cron === cron)?.tasks || [];
}

/** @experimental */
export async function runCronTasks(
  cron: string,
  ctx: { payload?: TaskPayload; context?: TaskContext }
): Promise<TaskResult[]> {
  await useNitroApp().ready;
  return Promise.all(getCronTasks(cron).map((name) => runTask(name, ctx)));
}

function stopCronJobs(cronJobs: Cron[]): void {
  for (const job of cronJobs.splice(0)) {
    try {
      job.stop();
    } catch (error) {
      console.error("Error while stopping scheduled task", error);
    }
  }
}

function warnRunningTasks(): void {
  const names = Object.keys(__runningTasks__).map((name) => `\`${name}\``);
  if (names.length > 0) {
    console.warn(`[nitro] Tasks still running after the shutdown timeout: ${names.join(", ")}`);
  }
}
