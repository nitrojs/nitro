import { AsyncLocalStorage } from "node:async_hooks";
import { type H3Event, createError } from "h3";
import type { NitroAsyncContext } from "nitro/types";
import { getContext } from "unctx";

export const nitroAsyncContext = getContext<NitroAsyncContext>("nitro-app", {
  asyncContext: import.meta._asyncContext,
  AsyncLocalStorage: import.meta._asyncContext ? AsyncLocalStorage : undefined,
});

/**
 *
 * Access to the current Nitro request event.
 *
 * @experimental
 *  - Requires `experimental.asyncContext: true` config to work.
 *  - Works in Node.js and limited runtimes only
 *
 */
export function useEvent(): H3Event {
  try {
    return nitroAsyncContext.use().event;
  } catch {
    const hint = import.meta._asyncContext
      ? "Note: This is an experimental feature and might be broken on non-Node.js environments."
      : "Enable the experimental flag using `experimental.asyncContext: true`.";
    throw createError({
      message: `Nitro request context is not available. ${hint}`,
    });
  }
}
