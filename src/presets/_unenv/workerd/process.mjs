// https://github.com/cloudflare/workerd/blob/main/src/node/internal/process.ts
// https://github.com/unjs/unenv/blob/main/src/runtime/node/process.ts

import workerdProcess from "#workerd/node:process";

import { env as WorkerEnv } from "cloudflare:workers";

import { Process as UnenvProcess } from "unenv/node/internal/process/process";
import { env as UnenvEnv } from "unenv/node/internal/process/env";
import { hrtime as UnenvHrTime } from "unenv/node/internal/process/hrtime";

// Polyfill for unenv (without Node.js compatibility)
globalThis.__env__ = WorkerEnv;

const mixedProcess = new UnenvProcess({
  env: UnenvEnv,
  hrtime: UnenvHrTime,
  nextTick: workerdProcess.nextTick,
});

// https://github.com/cloudflare/workerd/blob/main/src/node/internal/process.ts#L94
for (const key of ["exit", "getBuiltinModule", "platform"]) {
  if (key in workerdProcess) {
    mixedProcess[key] = workerdProcess[key];
  }
}

if (workerdProcess.features) {
  Object.defineProperty(mixedProcess, "features", {
    get() {
      return workerdProcess.features;
    },
  });
}

export default mixedProcess;

export const {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  umask,
  uptime,
  version,
  versions,
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding,
} = mixedProcess;
