import { definePlugin } from "nitro";
import type {
  IExportTraceServiceRequest,
  SpanContext,
  SpanInfo,
} from "./types.ts";
import { Span } from './span.ts'
import { TRACED_CHANNELS } from "./channels.ts";

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
 * Subscribes to the tracing channels declared in `TRACED_CHANNELS` (produced by
 * h3, srvx, unstorage, …) and reports a full OTLP span per completed operation,
 * buffered per request and flushed once via the Vercel runtime.
 */
export default definePlugin(() => {
  const diagnostics = globalThis.process?.getBuiltinModule?.("node:diagnostics_channel");
  if (!diagnostics?.subscribe) return;

  // Carry the start time from `start` to `asyncEnd` without mutating the producer's context object.
  const starts = new WeakMap<object, string>();

  // A `tracingChannel(<name>)` publishes to plain named channels
  // (`tracing:<name>:start`, `tracing:<name>:asyncEnd`, …). Subscribing to those
  // names directly — rather than wrapping `tracingChannel` — needs no global
  // patch and works regardless of when the producer creates the channel:
  // `subscribe` registers against the name whether the channel exists yet or
  // not. Channels absent from `TRACED_CHANNELS` are simply never subscribed.
  for (const name of Object.keys(TRACED_CHANNELS)) {
    const describe = TRACED_CHANNELS[name];

    diagnostics.subscribe(`tracing:${name}:start`, (message) => {
      starts.set(message as object, Span.nowUnixNano());
    });

    diagnostics.subscribe(`tracing:${name}:asyncEnd`, (message) => {
      try {
        const start = starts.get(message as object);
        if (start === undefined) return;
        starts.delete(message as object);

        // Derive span name, kind and semantic attributes from the operation. A
        // describer only throws on a payload shape it doesn't recognise (a
        // producer that changed shape); drop that span via the catch below
        // rather than emit a contentless one.
        const info = describe(name, message);
        reportSpan(info, start, (message as { error?: unknown }).error);
      } catch {
        // Malformed payload, or telemetry failure — never break the traced operation.
      }
    });
  }
});


function reportSpan(info: SpanInfo, startTimeUnixNano: string, error: unknown): void {
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
                scope: { name: SCOPE_NAME, version: "", attributes: [], droppedAttributesCount: 0 },
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
}

