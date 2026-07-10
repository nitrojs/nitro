import { definePlugin } from "nitro";
import type {
  IExportTraceServiceRequest,
  SpanContext,
  SpanInfo,
} from "#nitro/runtime/telemetry/types";
import { Span } from "#nitro/runtime/telemetry/span";
import { subscribeTracedChannels } from "#nitro/runtime/telemetry/subscribe";

/**
 * The Vercel runtime telemetry sink, `reportSpans` is fire-and-forget; the
 * runtime correlates spans to the request by `rootSpanContext.traceId`.
 */
interface VercelTelemetry {
  reportSpans(data: IExportTraceServiceRequest): void;
  rootSpanContext?: SpanContext;
}

interface RequestContext {
  telemetry?: VercelTelemetry;
  waitUntil: (task: (() => Promise<unknown>) | Promise<unknown>) => void;
}

interface RequestContextReader {
  get?(): RequestContext | undefined;
}

const REQUEST_CONTEXT_SYMBOL = Symbol.for("@vercel/request-context");

const SCOPE_NAME = "@nitro/vercel-tracing";

// Completed spans buffered per request (keyed by trace id) and flushed once at
// freeze time via `waitUntil`, so one IPC message carries the whole request
// instead of one per span (a redis-heavy request can emit a dozen).
const pendingSpans = new Map<string, Span[]>();

/**
 * Exports Nitro tracing-channel events to the Vercel runtime as OpenTelemetry
 * spans, without an OpenTelemetry SDK.
 *
 * Subscribes to the tracing channels instrumented by Nitro (h3, srvx,
 * unstorage, …) and reports a full OTLP span per completed operation, buffered
 * per request and flushed once via the Vercel runtime.
 *
 * Registered first (unshift) so it subscribes to the traced channels at
 * startup, before any request is handled.
 */
export default definePlugin(() => {
  subscribeTracedChannels((info, startTimeUnixNano, error) => {
    // Describer failed on the completed payload — nothing to report.
    if (!info) return;

    const context = (globalThis as Record<symbol, RequestContextReader | undefined>)[
      REQUEST_CONTEXT_SYMBOL
    ]?.get?.();

    const telemetry = context?.telemetry;
    const root = telemetry?.rootSpanContext;

    // Without a platform root span there is no trace to join; the runtime
    // correlates spans to the request by trace id and drops the rest.
    if (!context || !telemetry || !root) return;

    // Respect the platform sampling decision (bit 0 of traceFlags).
    if (root.traceFlags !== undefined && (root.traceFlags & 1) === 0) return;

    const span = new Span(root.traceId, root.spanId, info, startTimeUnixNano, error);

    // Buffer per request; the first span schedules a single flush at freeze time.
    let spans = pendingSpans.get(root.traceId);
    if (!spans) {
      spans = [];
      const { traceId } = root;
      const sink = telemetry;
      context.waitUntil(async () => {
        const batch = pendingSpans.get(traceId);
        pendingSpans.delete(traceId);
        if (!batch || batch.length === 0) return;
        // Wrap the batch in a single OTLP `ExportTraceServiceRequest` envelope.
        sink.reportSpans({
          resourceSpans: [
            {
              resource: { attributes: [], droppedAttributesCount: 0 },
              scopeSpans: [
                {
                  scope: {
                    name: SCOPE_NAME,
                    version: "",
                    attributes: [],
                    droppedAttributesCount: 0,
                  },
                  spans: batch,
                  schemaUrl: "",
                },
              ],
              schemaUrl: "",
            },
          ],
        });
      });
      pendingSpans.set(traceId, spans);
    }
    spans.push(span);
  });
});
