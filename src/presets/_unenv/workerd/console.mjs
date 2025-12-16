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

const consolePolyfill = {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times,
};

const consoleModule = /*@__PURE__*/ new Proxy(workerdConsole, {
  get(target, prop) {
    if (Reflect.has(target, prop)) {
      return Reflect.get(target, prop);
    }
    return Reflect.get(consolePolyfill, prop);
  },
});

export default consoleModule;
