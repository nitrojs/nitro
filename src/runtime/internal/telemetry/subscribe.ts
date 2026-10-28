import type { Channel } from "node:diagnostics_channel";
import type { SpanInfo } from "./types.ts";
import { TRACED_CHANNELS } from "./channels.ts";
import { Span } from "./span.ts";

/**
 * Called once per completed traced operation with the span info (derived from
 * the completed payload, falling back to the start-time payload for `onStart`
 * subscriptions), the operation start time (unix nanoseconds, as an OTLP
 * `*UnixNano` string), the operation's error (`undefined` when it succeeded)
 * and the state returned by `onStart` (`undefined` without one). A sink turns
 * this into whatever its platform consumes — an OTLP export, a log line, a
 * platform span, …
 */
export type SpanSink<S = unknown> = (
  info: SpanInfo,
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

export interface SubscribeTracingChannelsOptions<S> {
  /**
   * Replaces the subscriptions previously made with the same id, so a runtime
   * re-evaluated in the same process (Vite dev reloads) does not subscribe twice.
   */
  id?: string;
  /**
   * Called synchronously when a traced operation starts, inside its execution
   * context. Operations it returns `undefined` for are not tracked.
   */
  onStart: (name: string, message: unknown) => S | undefined;
  /** Called once the operation completes, with the state returned by `onStart`. */
  onEnd: (name: string, message: unknown, state: S) => void;
}

/**
 * Subscribes to the tracing channels declared in `TRACED_CHANNELS` (produced by
 * h3, srvx, unstorage, db0, …) and invokes `onSpan` once per traced operation.
 * Channels absent from `TRACED_CHANNELS` are never observed.
 *
 * A no-op when `node:diagnostics_channel` is unavailable (non-Node runtimes).
 */
export function subscribeTracedChannels<S = unknown>(
  onSpan: SpanSink<S>,
  options?: SubscribeTracedChannelsOptions<S>
): void {
  const onStart = options?.onStart;

  // Carry the start time (and any start-time info / sink state) from `start`
  // to completion without mutating the producer's context object.
  interface Pending {
    start: string;
    info: SpanInfo | undefined;
    state: S | undefined;
  }

  subscribeTracingChannels<Pending>(Object.keys(TRACED_CHANNELS), {
    onStart(name, message) {
      const entry: Pending = { start: Span.nowUnixNano(), info: undefined, state: undefined };
      if (onStart) {
        try {
          entry.info = TRACED_CHANNELS[name](name, message);
          entry.state = onStart(entry.info);
        } catch {
          // Malformed payload, or a sink failure (e.g. the platform refused to
          // open a span) — no state; the completion callback still fires.
        }
      }
      return entry;
    },
    onEnd(name, message, entry) {
      // Derive span name, kind and semantic attributes from the completed
      // operation. A describer only throws on a payload shape it doesn't
      // recognise (a producer that changed shape); fall back to the start-time
      // info (held for `onStart` subscriptions) so stateful sinks still get
      // the completion and can release their span.
      let info: SpanInfo | undefined;
      try {
        info = TRACED_CHANNELS[name](name, message);
      } catch {}
      info ??= entry.info;
      if (info === undefined) return;

      try {
        onSpan(info, entry.start, (message as { error?: unknown }).error, entry.state);
      } catch {
        // A sink failure must never break the traced operation.
      }
    },
  });
}

/**
 * Subscribes to the given tracing channels and pairs each operation's start
 * with its completion: normally `asyncEnd`, or `end` when the traced function
 * threw synchronously (`tracePromise` never publishes `asyncEnd` in that case).
 *
 * A `tracingChannel(<name>)` publishes to plain named channels
 * (`tracing:<name>:start`, `tracing:<name>:asyncEnd`, …). Subscribing to those
 * names directly — rather than wrapping `tracingChannel` — needs no global patch
 * and works regardless of when the producer creates the channel: `subscribe`
 * registers against the name whether the channel exists yet or not.
 *
 * Returns `false` when `node:diagnostics_channel` is unavailable (non-Node runtimes).
 */
export function subscribeTracingChannels<S>(
  names: readonly string[],
  { id, onStart, onEnd }: SubscribeTracingChannelsOptions<S>
): boolean {
  const diagnostics = globalThis.process?.getBuiltinModule?.("node:diagnostics_channel");
  if (!diagnostics?.subscribe) return false;

  // Subscribe on channel objects and keep them referenced: Bun drops subscriptions made by name
  // (`diagnostics.subscribe(name)`) once the channel is garbage collected.
  const subscriptions: [channel: Channel, listener: (message: unknown) => void][] = [];
  const subscribe = (channel: string, listener: (message: unknown) => void) => {
    subscriptions.push([diagnostics.channel(channel), listener]);
  };
  const pending = new WeakMap<object, S>();

  for (const name of names) {
    const complete = (message: unknown) => {
      const state = pending.get(message as object);
      if (state === undefined) return;
      pending.delete(message as object);
      onEnd(name, message, state);
    };
    subscribe(`tracing:${name}:start`, (message) => {
      const state = onStart(name, message);
      if (state !== undefined) pending.set(message as object, state);
    });
    subscribe(`tracing:${name}:asyncEnd`, complete);
    // In the normal async path `end` fires before the promise settles, while
    // `error` is still unset, so the guard makes this a no-op there.
    subscribe(`tracing:${name}:end`, (message) => {
      if ((message as { error?: unknown }).error !== undefined) complete(message);
    });
  }

  const registry = ((globalThis as Record<symbol, unknown>)[kSubscriptions] ??= new Map()) as Map<
    unknown,
    () => void
  >;
  if (id) registry.get(id)?.();
  registry.set(id || subscriptions, () => {
    for (const [channel, listener] of subscriptions) channel.unsubscribe(listener);
  });
  for (const [channel, listener] of subscriptions) channel.subscribe(listener);
  return true;
}

const kSubscriptions = /* @__PURE__ */ Symbol.for("nitro.tracingChannelSubscriptions");
