import type { SpanInfo } from "./types.ts";
import { TRACED_CHANNELS } from "./channels.ts";
import { Span } from "./span.ts";

/**
 * Called once per completed traced operation with the span info derived from
 * the completed payload (`undefined` when the describer failed on it), the
 * operation start time (unix nanoseconds, as an OTLP `*UnixNano` string), the
 * operation's error (`undefined` when it succeeded) and the state returned by
 * `onStart` (`undefined` without one). A sink turns this into whatever its
 * platform consumes — an OTLP export, a log line, a platform span, …
 */
export type SpanSink<S = unknown> = (
  info: SpanInfo | undefined,
  startTimeUnixNano: string,
  error: unknown,
  state: S | undefined
) => void;

export interface SubscribeTracedChannelsOptions<S> {
  /**
   * Called synchronously when a traced operation starts, inside its execution
   * context — where platform span APIs like Cloudflare's `enterSpan` must be
   * called. Returned state is handed back to `onSpan` at completion.
   */
  onStart?: (info: SpanInfo) => S | undefined;
}

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
export function subscribeTracedChannels<S = unknown>(
  onSpan: SpanSink<S>,
  options?: SubscribeTracedChannelsOptions<S>
): void {
  const diagnostics = globalThis.process?.getBuiltinModule?.("node:diagnostics_channel");
  if (!diagnostics?.subscribe) return;

  const onStart = options?.onStart;

  // Carry the start time (and any sink state) from `start` to completion
  // without mutating the producer's context object.
  const pending = new WeakMap<object, { start: string; state: S | undefined }>();

  for (const name of Object.keys(TRACED_CHANNELS)) {
    const describe = TRACED_CHANNELS[name];

    diagnostics.subscribe(`tracing:${name}:start`, (message) => {
      const entry = { start: Span.nowUnixNano(), state: undefined as S | undefined };
      if (onStart) {
        try {
          entry.state = onStart(describe(name, message));
        } catch {
          // Malformed payload, or a sink failure (e.g. the platform refused to
          // open a span) — no state; the completion callback still fires.
        }
      }
      pending.set(message as object, entry);
    });

    const complete = (message: unknown) => {
      const entry = pending.get(message as object);
      if (entry === undefined) return;
      pending.delete(message as object);

      // Derive span name, kind and semantic attributes from the completed
      // operation. A describer only throws on a payload shape it doesn't
      // recognise (a producer that changed shape); still deliver the
      // completion — without info — so stateful sinks can release their span.
      let info: SpanInfo | undefined;
      try {
        info = describe(name, message);
      } catch {}

      try {
        onSpan(info, entry.start, (message as { error?: unknown }).error, entry.state);
      } catch {
        // A sink failure must never break the traced operation.
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
