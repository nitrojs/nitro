import { definePlugin } from "nitro";
// Handle older compatibility dates without the custom-spans API
import * as cloudflare from "cloudflare:workers";
import type { Span, Tracing } from "@cloudflare/workers-types";
import type { IAnyValue } from "#nitro/runtime/telemetry/types";
import { subscribeTracedChannels } from "#nitro/runtime/telemetry/subscribe";

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
  if (typeof tracing?.enterSpan !== "function") return;

  subscribeTracedChannels<PendingSpan>(
    (info, _startTimeUnixNano, error, entry) => {
      if (!entry) return;
      try {
        // Skip attribute work for unsampled requests (`head_sampling_rate`).
        if (entry.span.isTraced) {
          // `info` is undefined when the describer failed on the completed
          // payload — the error is still recorded on the (already named) span.
          if (info) {
            for (const { key, value } of info.attributes) {
              entry.span.setAttribute(key, attributeValue(value));
            }
          }
          if (error !== undefined) {
            recordException(entry.span, error);
          }
        }
      } finally {
        entry.close();
      }
    },
    {
      onStart(info) {
        let close!: () => void;
        const done = new Promise<void>((resolve) => {
          close = resolve;
        });
        let entry: PendingSpan | undefined;
        tracing.enterSpan(info.name, (span) => {
          entry = { span, close };
          return done;
        });
        return entry;
      },
    }
  );
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
