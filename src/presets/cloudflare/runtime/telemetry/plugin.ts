import { definePlugin } from "nitro";
// Handle older compatibility dates without the custom-spans API
import * as cloudflare from "cloudflare:workers";
import type { Span, Tracing } from "@cloudflare/workers-types";
import type { IAnyValue } from "#nitro/runtime/telemetry/types";
import { TRACED_CHANNELS } from "#nitro/runtime/telemetry/channels";

// https://developers.cloudflare.com/workers/observability/traces/custom-spans/
const tracing = (cloudflare as { tracing?: Tracing }).tracing;

interface PendingSpan {
  span: Span;
  close: () => void;
}

/**
 * Exports Nitro tracing-channel events as Cloudflare Workers custom spans,
 * alongside Cloudflare's automatic instrumentation (fetch, KV, D1, …)
 */
export default definePlugin(() => {
  const diagnostics = globalThis.process?.getBuiltinModule?.("node:diagnostics_channel");
  if (!diagnostics?.subscribe || typeof tracing?.enterSpan !== "function") return;

  // Open span + closer per in-flight operation, keyed by the context object
  // `tracingChannel` publishes to every phase of the same operation.
  const pending = new WeakMap<object, PendingSpan>();

  for (const name of Object.keys(TRACED_CHANNELS)) {
    const describe = TRACED_CHANNELS[name];

    diagnostics.subscribe(`tracing:${name}:start`, (message) => {
      try {
        // The span name is fixed at creation (Cloudflare has no rename API),
        // so it is derived from the start payload; end-time data (status code,
        // matched route) lands in the attributes set at `asyncEnd`.
        const info = describe(name, message);

        let close!: () => void;
        const done = new Promise<void>((resolve) => {
          close = resolve;
        });
        tracing.enterSpan(info.name, (span) => {
          pending.set(message as object, { span, close });
          return done;
        });
      } catch {
        // Malformed payload, or tracing rejected the span (e.g. outside a
        // request) — skip it, never break the traced operation.
      }
    });

    const finalize = (message: unknown) => {
      const entry = pending.get(message as object);
      if (!entry) return;
      pending.delete(message as object);
      try {
        // Skip attribute work for unsampled requests (`head_sampling_rate`).
        if (entry.span.isTraced) {
          // Re-describe on the completed payload: by now producers have set
          // end-time fields (`result.status`, `context.matchedRoute`, …).
          const info = describe(name, message);
          for (const { key, value } of info.attributes) {
            entry.span.setAttribute(key, attributeValue(value));
          }
          const error = (message as { error?: unknown }).error;
          if (error !== undefined) {
            recordException(entry.span, error);
          }
        }
      } catch {
        // Never break the traced operation.
      } finally {
        entry.close();
      }
    };

    diagnostics.subscribe(`tracing:${name}:asyncEnd`, finalize);

    // `tracePromise` never publishes `asyncEnd` when the traced function
    // throws synchronously — only `end`, with `error` already set. In the
    // normal async path `end` fires before the promise settles, while `error`
    // is still unset, so the guard makes this a no-op there.
    diagnostics.subscribe(`tracing:${name}:end`, (message) => {
      if ((message as { error?: unknown }).error !== undefined) {
        finalize(message);
      }
    });
  }
});

/** OTLP `IAnyValue` (from the shared describers) → Cloudflare attribute value. */
function attributeValue(value: IAnyValue): string | number | boolean | undefined {
  if (value.stringValue != null) return value.stringValue;
  if (value.intValue != null) return value.intValue;
  if (value.doubleValue != null) return value.doubleValue;
  if (value.boolValue != null) return value.boolValue;
}

/**
 * OTEL exception semconv, flattened onto span attributes — the Cloudflare API
 * has no span events, and `setOutcome` is not available yet.
 */
function recordException(span: Span, error: unknown): void {
  const err = error as Partial<Error> | undefined;
  if (typeof err?.name === "string") {
    span.setAttribute("exception.type", err.name);
  }
  span.setAttribute(
    "exception.message",
    typeof err?.message === "string" ? err.message : String(error)
  );
  if (typeof err?.stack === "string") {
    span.setAttribute("exception.stacktrace", err.stack);
  }
}
