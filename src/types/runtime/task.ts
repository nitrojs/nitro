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
  run(event: TaskEvent): MaybePromise<TaskResult<RT>>;
}

/** @experimental */
export interface TaskRunnerOptions {
  cwd?: string;
  buildDir?: string;
}
