import type { ServerTimingMetric } from "./server-timing.ts";
import { beginOp, endOp, useALS } from "./server-timing.ts";
import { countLabel } from "./_server-timing-labels.ts";

/**
 * Records `kv` / `db` busy time from the tracing channels published by
 * `unstorage/tracing` and `db0/tracing`. A no-op on runtimes without
 * `node:diagnostics_channel` or `node:async_hooks`.
 */
export function traceServerTiming(name: "kv" | "db", channels: readonly string[]): void {
  const subscribed = ((traceServerTiming as { _subscribed?: Set<string> })._subscribed ??=
    new Set());
  const diagnostics = globalThis.process?.getBuiltinModule?.("node:diagnostics_channel");
  const als = useALS();
  if (!als || !diagnostics?.subscribe || subscribed.has(name)) {
    return;
  }
  subscribed.add(name);
  const label = name === "kv" ? countLabel("op", "ops") : countLabel("query", "queries");

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
      const metric = beginOp(als.getStore(), name, label);
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
}
