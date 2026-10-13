// Structural types of `consola` instances. `consola` is bundled, and its prompt types use a
// `unique symbol`, so inlined copies of `ConsolaInstance` would not be assignable to each other.

/**
 * Log level (`LogLevel` from `consola`).
 *
 * @see https://github.com/unjs/consola#log-level
 */
export type LogLevel = 0 | 1 | 2 | 3 | 4 | 5 | (number & {});

type LogType =
  | "silent"
  | "fatal"
  | "error"
  | "warn"
  | "log"
  | "info"
  | "success"
  | "fail"
  | "ready"
  | "start"
  | "box"
  | "debug"
  | "trace"
  | "verbose";

type LogFn = {
  (message: any, ...args: any[]): void;
  raw: (...args: any[]) => void;
};

/**
 * Logger (`ConsolaInstance` from `consola`).
 *
 * @see https://github.com/unjs/consola
 */
export type ConsolaInstance = Record<LogType, LogFn> & {
  level: LogLevel;
  withTag(tag: string): ConsolaInstance;
};
