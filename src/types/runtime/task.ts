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

/** @experimental */
export interface Task<RT = unknown> {
  meta?: TaskMeta;
  run(event: TaskEvent): MaybePromise<{ result?: RT }>;
}

/** @experimental */
export interface TaskRunnerOptions {
  cwd?: string;
  buildDir?: string;
  /**
   * Socket inactivity timeout in milliseconds for requests to the dev server.
   *
   * `listTasks()` defaults to 30 seconds, since the dev server answers it
   * immediately. `runTask()` has no default: the socket stays idle for as long
   * as the task runs, so a default would cap the task's own duration.
   */
  timeout?: number;
}
