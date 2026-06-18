import { definePlugin } from "nitro";
import type { TracingChannel } from "node:diagnostics_channel";
import type {
  IExportTraceServiceRequest,
  IKeyValue,
  ISpan,
  SpanContext,
} from "./telemetry-types.ts";

/**
 * Exports Nitro tracing-channel events to the Vercel runtime as OpenTelemetry
 * spans, without an OpenTelemetry SDK.
 *
 * Subscribes to every Node `tracingChannel` a producer (h3, srvx, unstorage, …)
 * creates and reports a full OTLP span per completed operation.
 */

const REQUEST_CONTEXT_SYMBOL = Symbol.for("@vercel/request-context");

// OTLP `SpanKind` (proto enum) Wire values: INTERNAL = 1, SERVER = 2, CLIENT = 3.
const SPAN_KIND_INTERNAL = 1;
const SPAN_KIND_CLIENT = 3;

// OTLP `Status.StatusCode` (proto enum): UNSET = 0, OK = 1, ERROR = 2. A
const STATUS_CODE_ERROR = 2;

const SCOPE_NAME = "@nitro/vercel-tracing";

/**
 * The Vercel runtime telemetry sink, exposed per-request via the global
 * `@vercel/request-context` reader. `reportSpans` is fire-and-forget; the
 * runtime correlates spans to the request by `rootSpanContext.traceId`.
 */
interface VercelTelemetry {
  reportSpans(data: IExportTraceServiceRequest): void;
  rootSpanContext?: SpanContext;
}

interface RequestContextReader {
  get?(): { telemetry?: VercelTelemetry } | undefined;
}

function getTelemetry(): VercelTelemetry | undefined {
  return (globalThis as Record<symbol, RequestContextReader | undefined>)[
    REQUEST_CONTEXT_SYMBOL
  ]?.get?.()?.telemetry;
}

/** Name, kind and attributes derived from a completed channel operation. */
interface SpanInfo {
  name: string;
  kind: number;
  attributes: IKeyValue[];
}

/**
 * A single OTLP span. Declared as a class (fixed shape, shared prototype) so
 * every span is the same hidden class — cheaper to build and serialize than ad
 * hoc literals. The Vercel runtime validates the payload strictly, so every
 * OTLP field is present even when empty (omitting e.g. `events` or `attributes`
 * makes the runtime drop the whole batch).
 */
class Span {
  traceId: string;
  spanId: string;
  // Parent on the platform root so spans appear as flat siblings.
  parentSpanId: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  traceState = "";
  droppedAttributesCount = 0;
  events: never[] = [];
  droppedEventsCount = 0;
  links: never[] = [];
  droppedLinksCount = 0;
  attributes: Array<{ key: string; value: { stringValue: string } }>;
  status: { code: number; message: string };

  constructor(
    traceId: string,
    parentSpanId: string,
    name: string,
    kind: number,
    startTimeUnixNano: string,
    error: unknown
  ) {
    this.traceId = traceId;
    this.spanId = Span.randomSpanId();
    this.parentSpanId = parentSpanId;
    this.name = name;
    this.kind = kind;
    this.startTimeUnixNano = startTimeUnixNano;
    this.endTimeUnixNano = Span.nowUnixNano();
    this.attributes = [{ key: "nitro.channel", value: { stringValue: name } }];
    this.status =
      error === undefined
        ? { code: 0, message: "" }
        : { code: STATUS_CODE_ERROR, message: String((error as any)?.message ?? error) };
  }

  /** Wall-clock nanoseconds as a string, as required by OTLP `*UnixNano` fields. */
  static nowUnixNano(): string {
    const ms = performance.timeOrigin + performance.now();
    return (BigInt(Math.trunc(ms)) * 1_000_000n + BigInt(Math.round((ms % 1) * 1e6))).toString();
  }

  /** 8 random bytes, hex-encoded — an OTLP span id (never the all-zero sentinel). */
  static randomSpanId(): string {
    let id = "";
    for (let i = 0; i < 8; i++) {
      id += Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0");
    }
    return id === "0000000000000000" ? "0000000000000001" : id;
  }
}

function reportSpan(channel: string, startTimeUnixNano: string, error?: unknown): void {
  const telemetry = getTelemetry();
  const root = telemetry?.rootSpanContext;

  // Without a platform root span there is no trace to join
  // The runtime correlates spans to the request by trace id and drops the rest
  if (!root) return;

  // Respect the platform sampling decision (bit 0 of traceFlags).
  if (root.traceFlags !== undefined && (root.traceFlags & 1) === 0) return;

  const span = new Span(
    root.traceId,
    root.spanId,
    channel,
    SPAN_KIND_INTERNAL,
    startTimeUnixNano,
    error
  );

  telemetry.reportSpans({
    resourceSpans: [
      {
        resource: { attributes: [], droppedAttributesCount: 0 },
        scopeSpans: [
          {
            scope: { name: SCOPE_NAME, version: "", attributes: [], droppedAttributesCount: 0 },
            spans: [span],
            schemaUrl: "",
          },
        ],
        schemaUrl: "",
      },
    ],
  });
}

// Patch `tracingChannel` once, even if the plugin initialises more than once.
let patched = false;

export default definePlugin(() => {
  const diagnostics = globalThis.process?.getBuiltinModule?.("node:diagnostics_channel");
  if (!diagnostics?.tracingChannel || patched) return;
  patched = true;

  const { tracingChannel: createTracingChannel } = diagnostics;
  const instrumented = new Set<string>();

  const instrument = (
    name: unknown,
    channel: TracingChannel<unknown, Record<string, unknown>>
  ): void => {
    if (typeof name !== "string" || instrumented.has(name)) return;
    instrumented.add(name);

    // Carry the start time from `start` to `asyncEnd` without mutating the producer's context object.
    const starts = new WeakMap<object, string>();

    channel.subscribe({
      start(data: any) {
        starts.set(data, Span.nowUnixNano());
      },
      end() {},
      asyncStart() {},
      error() {},
      asyncEnd(data: any) {
        try {
          const start = starts.get(data);
          if (start === undefined) return;
          starts.delete(data);
          // This reports one span per IPC message. TODO: for high span-count
          // requests, batch spans per request and flush once (via `waitUntil`) to
          // cut IPC overhead as `@vercel/otel` does with its BatchSpanProcessor.
          reportSpan(name, start, data.error);
        } catch {
          // Telemetry must never break the traced operation.
        }
      },
    });
  };

  // Wrap `tracingChannel` to instrument each channel as a producer creates it.
  // Registered first (see preset) so this is in place before producers run;
  // channels created at module-load time would be missed.
  type CreateTracingChannel = typeof diagnostics.tracingChannel;
  diagnostics.tracingChannel = ((nameOrChannels: Parameters<CreateTracingChannel>[0]) => {
    const channel = createTracingChannel(nameOrChannels);
    instrument(nameOrChannels, channel as TracingChannel<unknown, Record<string, unknown>>);
    return channel;
  }) as CreateTracingChannel;
});
