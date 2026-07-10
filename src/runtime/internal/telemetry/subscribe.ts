import type { SpanInfo } from "./types.ts";
import { TRACED_CHANNELS } from "./channels.ts";
import { Span } from "./span.ts";

/**
 * Called once per completed traced operation with the derived span info, the
 * operation start time (unix nanoseconds, as an OTLP `*UnixNano` string) and the
 * operation's error (`undefined` when it succeeded). A sink turns this into
 * whatever its platform consumes — an OTLP export, a log line, …
 */
export type SpanSink = (info: SpanInfo, startTimeUnixNano: string, error: unknown) => void;

/**
 * Subscribes to the tracing channels declared in `TRACED_CHANNELS` (produced by
 * h3, srvx, unstorage, …) and invokes `onSpan` once per traced operation:
 * normally at `asyncEnd`, or at `end` when the traced function threw
 * synchronously (`tracePromise` never publishes `asyncEnd` in that case).
 *
 * A `tracingChannel(<name>)` publishes to plain named channels
 * (`tracing:<name>:start`, `tracing:<name>:asyncEnd`, …). Subscribing to those
 * names directly — rather than wrapping `tracingChannel` — needs no global patch
 * and works regardless of when the producer creates the channel: `subscribe`
 * registers against the name whether the channel exists yet or not. Channels
 * absent from `TRACED_CHANNELS` are never observed.
 *
 * A no-op when `node:diagnostics_channel` is unavailable (non-Node runtimes).
 */
export function subscribeTracedChannels(onSpan: SpanSink): void {
  const diagnostics = globalThis.process?.getBuiltinModule?.("node:diagnostics_channel");
  if (!diagnostics?.subscribe) return;

  // Carry the start time from `start` to completion without mutating the producer's context object.
  const starts = new WeakMap<object, string>();

  for (const name of Object.keys(TRACED_CHANNELS)) {
    const describe = TRACED_CHANNELS[name];

    diagnostics.subscribe(`tracing:${name}:start`, (message) => {
      starts.set(message as object, Span.nowUnixNano());
    });

    const complete = (message: unknown) => {
      try {
        const start = starts.get(message as object);
        if (start === undefined) return;
        starts.delete(message as object);

        // Derive span name, kind and semantic attributes from the operation. A
        // describer only throws on a payload shape it doesn't recognise (a
        // producer that changed shape); drop that span via the catch below
        // rather than emit a contentless one.
        const info = describe(name, message);
        onSpan(info, start, (message as { error?: unknown }).error);
      } catch {
        // Malformed payload, or a sink failure — never break the traced operation.
      }
    };

    diagnostics.subscribe(`tracing:${name}:asyncEnd`, complete);

    // `tracePromise` never publishes `asyncEnd` when the traced function
    // throws synchronously — only `end`, with `error` already set. In the
    // normal async path `end` fires before the promise settles, while `error`
    // is still unset, so the guard makes this a no-op there.
    diagnostics.subscribe(`tracing:${name}:end`, (message) => {
      if ((message as { error?: unknown }).error !== undefined) {
        complete(message);
      }
    });
  }
}
