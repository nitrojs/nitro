import { Cron } from "croner";
import { HTTPError } from "h3";
import type { Task, TaskContext, TaskEvent, TaskPayload, TaskResult } from "nitro/types";
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

const __runningTasks__: { [name: string]: ReturnType<Task<any>["run"]> } = {};
let isShuttingDown = false;
let closeHookRegistered = false;

function ensureCloseHook(): void {
  if (closeHookRegistered) {
    return;
  }
  closeHookRegistered = true;
  useNitroHooks().hook("close", () => waitForRunningTasks());
}

/** @experimental */
export async function waitForRunningTasks(timeoutMs?: number): Promise<void> {
  isShuttingDown = true;
  const running = Object.values(__runningTasks__);
  if (running.length === 0) {
    return;
  }
  const timeout =
    typeof timeoutMs === "number"
      ? timeoutMs
      : (Number.parseInt(
          process.env.NITRO_SHUTDOWN_TIMEOUT || process.env.SERVER_SHUTDOWN_TIMEOUT || ""
        ) || 5) * 1000;

  const waitPromise = Promise.allSettled(running);
  if (timeout > 0) {
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeout);
    });
    try {
      await Promise.race([waitPromise, timeoutPromise]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  } else {
    await waitPromise;
  }
}

/** @internal */
export function _resetTasksState(): void {
  isShuttingDown = false;
  closeHookRegistered = false;
  for (const key of Object.keys(__runningTasks__)) {
    delete __runningTasks__[key];
  }
}

/** @experimental */
export async function runTask<RT = unknown>(
  name: string,
  { payload = {}, context = {} }: { payload?: TaskPayload; context?: TaskContext } = {}
): Promise<TaskResult<RT>> {
  if (isShuttingDown) {
    throw new HTTPError({
      message: "Server is shutting down",
      status: 503,
    });
  }

  ensureCloseHook();

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

  const taskPromise = (async () => {
    const handler = (await tasks[name].resolve!()) as Task<RT>;
    const taskEvent: TaskEvent = { name, payload, context };
    return handler.run(taskEvent);
  })();

  __runningTasks__[name] = taskPromise;

  try {
    const res = await taskPromise;
    return res;
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
  if (!scheduleRunner || !scheduledTasks || scheduledTasks.length === 0 || process.env.TEST) {
    return;
  }

  const payload: TaskPayload = {
    scheduledTime: Date.now(),
  };

  const cronJobs: Cron[] = [];
  closeHookRegistered = true;
  useNitroHooks().hook("close", async () => {
    isShuttingDown = true;
    for (const job of cronJobs) {
      try {
        job.stop();
      } catch (error) {
        console.error("Error while stopping scheduled task", error);
      }
    }
    await waitForRunningTasks();
  });

  for (const schedule of scheduledTasks) {
    cronJobs.push(
      new Cron(schedule.cron, async () => {
        try {
          await useNitroApp().ready;
        } catch {
          // Plugin initialization failed and was already reported
          return;
        }
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
