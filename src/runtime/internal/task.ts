import { Cron } from "croner";
import { HTTPError } from "h3";
import type {
  Task,
  TaskContext,
  TaskConcurrency,
  TaskEvent,
  TaskPayload,
  TaskResult,
} from "nitro/types";
import { scheduledTasks, tasks } from "#nitro/virtual/tasks";

/** @experimental */
export function defineTask<RT = unknown>(def: Task<RT>): Task<RT> {
  if (typeof def.run !== "function") {
    def.run = () => {
      throw new TypeError("Task must implement a `run` method!");
    };
  }
  return def;
}

const __runningTasks__ = new Map<string, Promise<TaskResult>>();
const __serialQueues__ = new Map<string, Promise<void>>();

/** @experimental */
export async function runTask<RT = unknown>(
  name: string,
  { payload = {}, context = {} }: { payload?: TaskPayload; context?: TaskContext } = {}
): Promise<TaskResult<RT>> {
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

  const handler = (await tasks[name].resolve!()) as Task<RT>;
  const taskEvent: TaskEvent = { name, payload, context };
  const concurrency: TaskConcurrency = handler.concurrency ?? { mode: "dedupe" };

  switch (concurrency.mode) {
    case "parallel": {
      return _callTask(handler, taskEvent);
    }
    case "dedupe": {
      const key = _getTaskConcurrencyKey(concurrency, taskEvent);
      return _runTaskOnce(key, () => _callTask(handler, taskEvent));
    }
    case "serial": {
      const key = _getTaskConcurrencyKey(concurrency, taskEvent);
      return _runTaskSerially(key, () => _callTask(handler, taskEvent));
    }
    default: {
      const mode = (concurrency as { mode: string }).mode;
      throw new Error(`Task \`${name}\` has an invalid concurrency mode: "${mode}"`);
    }
  }
}

async function _callTask<RT>(handler: Task<RT>, taskEvent: TaskEvent): Promise<TaskResult<RT>> {
  return await handler.run(taskEvent);
}

function _getTaskConcurrencyKey(
  concurrency: Exclude<TaskConcurrency, { mode: "parallel" }>,
  taskEvent: TaskEvent
): string {
  const key = concurrency.key?.(taskEvent);
  return key === undefined ? taskEvent.name : `${taskEvent.name}:${key}`;
}

function _runTaskOnce<RT>(
  key: string,
  run: () => Promise<TaskResult<RT>>
): Promise<TaskResult<RT>> {
  const running = __runningTasks__.get(key);
  if (running) {
    return running as Promise<TaskResult<RT>>;
  }

  const promise = run().finally(() => {
    if (__runningTasks__.get(key) === promise) {
      __runningTasks__.delete(key);
    }
  });
  __runningTasks__.set(key, promise);

  return promise;
}

function _runTaskSerially<RT>(
  key: string,
  run: () => Promise<TaskResult<RT>>
): Promise<TaskResult<RT>> {
  const previous = __serialQueues__.get(key) ?? Promise.resolve();
  const promise = previous.then(run);
  const queue = promise
    .catch(() => {})
    .then(() => {
      if (__serialQueues__.get(key) === queue) {
        __serialQueues__.delete(key);
      }
    });
  __serialQueues__.set(key, queue);

  return promise;
}

/** @experimental */
export function startScheduleRunner({
  waitUntil,
}: {
  waitUntil?: ((promise: Promise<unknown>) => void) | undefined;
} = {}): void {
  if (!scheduledTasks || scheduledTasks.length === 0 || process.env.TEST) {
    return;
  }

  const payload: TaskPayload = {
    scheduledTime: Date.now(),
  };

  for (const schedule of scheduledTasks) {
    new Cron(schedule.cron, async () => {
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
    });
  }
}

/** @experimental */
export function getCronTasks(cron: string): string[] {
  return (scheduledTasks || []).find((task) => task.cron === cron)?.tasks || [];
}

/** @experimental */
export function runCronTasks(
  cron: string,
  ctx: { payload?: TaskPayload; context?: TaskContext }
): Promise<TaskResult[]> {
  return Promise.all(getCronTasks(cron).map((name) => runTask(name, ctx)));
}
