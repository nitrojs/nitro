// https://github.com/cloudflare/workers-sdk/blob/main/packages/unenv-preset/src/runtime/node/console/index.ts

import workerdConsole from "#workerd/node:console";

import {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times,
} from "unenv/node/console";

export {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times,
} from "unenv/node/console";

export const {
  assert,
  clear,
  context,
  count,
  countReset,
  createTask,
  debug,
  dir,
  dirxml,
  error,
  group,
  groupCollapsed,
  groupEnd,
  info,
  log,
  profile,
  profileEnd,
  table,
  time,
  timeEnd,
  timeLog,
  timeStamp,
  trace,
  warn,
} = workerdConsole;

Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times,
});

// eslint-disable-next-line unicorn/prefer-export-from
export default workerdConsole;
