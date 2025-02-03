// https://github.com/cloudflare/workers-sdk/blob/main/packages/unenv-preset/src/runtime/node/async_hooks/index.ts

import {
  // asyncWrapProviders,
  createHook,
  executionAsyncId,
  executionAsyncResource,
  triggerAsyncId,
} from "unenv/runtime/node/async_hooks/index";

export {
  // asyncWrapProviders,
  createHook,
  executionAsyncId,
  executionAsyncResource,
  triggerAsyncId,
} from "unenv/runtime/node/async_hooks/index";

const workerdAsyncHooks = globalThis["proces" + "s"].getBuiltinModule("node:async_hooks");

export const { AsyncLocalStorage, AsyncResource } = workerdAsyncHooks;

export default {
  createHook,
  executionAsyncId,
  executionAsyncResource,
  triggerAsyncId,
  AsyncLocalStorage,
  AsyncResource,
}
