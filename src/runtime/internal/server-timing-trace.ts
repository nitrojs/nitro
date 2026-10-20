import { QUERY_CHANNEL } from "db0/tracing";
import type { ServerTimingMetric } from "./server-timing.ts";
import { beginOp, endOp, useALS, useServerTimingState } from "./server-timing.ts";
import { UNSTORAGE_OPERATIONS } from "./telemetry/unstorage.ts";

/**
 * Records `kv` / `db` busy time from the tracing channels published by
 * `unstorage/tracing` and `db0/tracing`.
 *
 * Returns `false` on runtimes without `node:diagnostics_channel` or `node:async_hooks`, where
 * operations can't be attributed to a request and wrapping with `withTracing` is wasted work.
 */
export function traceServerTiming(
  name: "kv" | "db",
  channels: readonly string[] = name === "kv"
    ? UNSTORAGE_OPERATIONS.map((operation) => `unstorage.${operation}`)
    : [QUERY_CHANNEL]
): boolean {
  const diagnostics = globalThis.process?.getBuiltinModule?.("node:diagnostics_channel");
  if (!useALS() || !diagnostics?.subscribe) {
    return false;
  }
  const state = useServerTimingState();
  if (state.traced.has(name)) {
    return true;
  }
  state.traced.add(name);

  const pending = new WeakMap<object, ServerTimingMetric>();
  const complete = (message: unknown) => {
    const metric = pending.get(message as object);
    if (metric) {
      pending.delete(message as object);
      endOp(metric);
    }
  };

  for (const channel of channels) {
    diagnostics.subscribe(`tracing:${channel}:start`, (message) => {
      const metric = beginOp(state.getStore?.(), name);
      if (metric) {
        pending.set(message as object, metric);
      }
    });
    diagnostics.subscribe(`tracing:${channel}:asyncEnd`, complete);
    // `tracePromise` publishes only `end` (with `error`) when the traced function throws synchronously.
    diagnostics.subscribe(`tracing:${channel}:end`, (message) => {
      if ((message as { error?: unknown }).error !== undefined) {
        complete(message);
      }
    });
  }
  return true;
}
