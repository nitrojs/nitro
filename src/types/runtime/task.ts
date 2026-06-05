type MaybePromise<T> = T | Promise<T>;

/** @experimental */
export interface TaskContext {}

/** @experimental */
export interface TaskPayload {
  [key: string]: unknown;
}

/** @experimental */
export interface TaskMeta {
  name?: string;
  description?: string;
}

/** @experimental */
export interface TaskEvent {
  name: string;
  payload: TaskPayload;
  context: TaskContext;
}

/** @experimental */
export interface TaskResult<RT = unknown> {
  result?: RT;
}

/**
 * Controls how concurrent calls to the same task are handled.
 *
 * - `"parallel"`: Allow multiple instances of the same task to run concurrently.
 * - `"dedupe"`: Coalesce concurrent calls with the same key into a single execution.
 *   All callers await the same promise and receive the same result. (default)
 * - `"serial"`: Queue concurrent calls with the same key so they run one after another.
 *
 * @experimental
 * @default { mode: "dedupe" }
 */
export type TaskConcurrency =
  | { mode: "parallel" }
  | {
      mode: "dedupe" | "serial";
      /**
       * Derives the dedupe or serial queue key from the task event.
       * If omitted, the task name is used.
       *
       * @default (event) => event.name
       */
      key?: (event: TaskEvent) => string;
    };

/** @experimental */
export interface Task<RT = unknown> {
  meta?: TaskMeta;
  run(event: TaskEvent): MaybePromise<{ result?: RT }>;
  concurrency?: TaskConcurrency;
}

/** @experimental */
export interface TaskRunnerOptions {
  cwd?: string;
  buildDir?: string;
}
