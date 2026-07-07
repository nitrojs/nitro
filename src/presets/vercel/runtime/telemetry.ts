import { definePlugin } from "nitro";
import type { TracingChannel } from "node:diagnostics_channel";
import type {
  IExportTraceServiceRequest,
  IKeyValue,
  ISpan,
  ISpanEvent,
  SpanContext,
} from "./telemetry-types.ts";

/**
 * Exports Nitro tracing-channel events to the Vercel runtime as OpenTelemetry
 * spans, without an OpenTelemetry SDK.
 *
 * Subscribes to every Node `tracingChannel` a producer (h3, srvx, unstorage, …)
 * creates and reports a full OTLP span per completed operation, buffered per
 * request and flushed once via the Vercel runtime.
 */

const REQUEST_CONTEXT_SYMBOL = Symbol.for("@vercel/request-context");

// OTLP `SpanKind` (proto enum) Wire values: INTERNAL = 1, SERVER = 2, CLIENT = 3.
const SPAN_KIND_INTERNAL = 1;
const SPAN_KIND_CLIENT = 3;

// OTLP `Status.StatusCode` (proto enum): UNSET = 0, OK = 1, ERROR = 2.
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

interface RequestContext {
  telemetry?: VercelTelemetry;
  waitUntil: (task: (() => Promise<unknown>) | Promise<unknown>) => void;
}

interface RequestContextReader {
  get?(): RequestContext | undefined;
}

function getRequestContext(): RequestContext | undefined {
  return (globalThis as Record<symbol, RequestContextReader | undefined>)[
    REQUEST_CONTEXT_SYMBOL
  ]?.get?.();
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
class Span implements ISpan {
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
  events: ISpanEvent[];
  droppedEventsCount = 0;
  links: never[] = [];
  droppedLinksCount = 0;
  attributes: IKeyValue[];
  status: { code: number; message: string };

  constructor(
    traceId: string,
    parentSpanId: string,
    info: SpanInfo,
    startTimeUnixNano: string,
    error: unknown
  ) {
    this.traceId = traceId;
    this.spanId = Span.randomSpanId();
    this.parentSpanId = parentSpanId;
    this.name = info.name;
    this.kind = info.kind;
    this.attributes = info.attributes;
    this.startTimeUnixNano = startTimeUnixNano;
    this.endTimeUnixNano = Span.nowUnixNano();
    if (error === undefined) {
      this.status = { code: 0, message: "" };
      this.events = [];
    } else {
      const err = error as Partial<Error> | undefined;
      const message = typeof err?.message === "string" ? err.message : String(error);
      this.status = { code: STATUS_CODE_ERROR, message };
      // OTEL exception semconv: record the error as an `exception` span event so
      // backends surface its type/message/stacktrace, not just an error status.
      this.events = [exceptionEvent(err, message, this.endTimeUnixNano)];
    }
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

// Completed spans buffered per request (keyed by trace id) and flushed once at
// freeze time via `waitUntil`, so one IPC message carries the whole request
// instead of one per span (a redis-heavy request can emit a dozen).
const pendingSpans = new Map<string, Span[]>();

function reportSpan(info: SpanInfo, startTimeUnixNano: string, error: unknown): void {
  const context = getRequestContext();
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
      if (batch && batch.length > 0) sink.reportSpans(envelope(batch));
    });
    pendingSpans.set(traceId, spans);
  }
  spans.push(span);
}

/** Wrap spans in a single OTLP `ExportTraceServiceRequest` envelope. */
function envelope(spans: Span[]): IExportTraceServiceRequest {
  return {
    resourceSpans: [
      {
        resource: { attributes: [], droppedAttributesCount: 0 },
        scopeSpans: [
          {
            scope: { name: SCOPE_NAME, version: "", attributes: [], droppedAttributesCount: 0 },
            spans,
            schemaUrl: "",
          },
        ],
        schemaUrl: "",
      },
    ],
  };
}

/**
 * Maps a completed channel operation to a span name, kind and attributes. Each
 * describer casts `data` to the payload its producer documents and reads fields
 * directly; a malformed payload throws and is caught by `describeSpan`.
 */
type ChannelDescriber = (channel: string, data: unknown) => SpanInfo;

// Fixed channel name → describer.
const CHANNEL_DESCRIBERS: Record<string, ChannelDescriber> = {
  "h3.request": describeH3Request,
  "srvx.request": describeSrvxRequest,
  "srvx.middleware": describeSrvxMiddleware,
};

// Namespaced channels with a dynamic operation suffix (e.g. `unstorage.getItem`,
// `unstorage.setItem`). Matched by prefix; first match wins. A future `db0.*`
// would slot in here as another entry.
const PREFIX_DESCRIBERS: Array<{ prefix: string; describe: ChannelDescriber }> = [
  { prefix: "unstorage.", describe: describeUnstorage },
];

/** h3's `TracingRequestEvent` (channel `h3.request`). */
interface H3RequestData {
  type: "middleware" | "route";
  event: { req: { method: string }; url: { pathname: string } };
}

function describeH3Request(channel: string, data: unknown): SpanInfo {
  const { event, type } = data as H3RequestData;
  const method = event.req.method;
  const path = event.url.pathname;
  return {
    name: type === "middleware" ? `middleware ${method} ${path}` : `${method} ${path}`,
    kind: SPAN_KIND_INTERNAL,
    attributes: [
      { key: "nitro.channel", value: { stringValue: channel } },
      { key: "http.request.method", value: { stringValue: method } },
      { key: "url.path", value: { stringValue: path } },
      { key: "nitro.h3.handler_type", value: { stringValue: type } },
    ],
  };
}

/** srvx's `RequestEvent` (channel `srvx.request`); `result` is absent on error. */
interface SrvxRequestData {
  request: { method: string; url: string };
  result?: { status: number };
}

function describeSrvxRequest(channel: string, data: unknown): SpanInfo {
  const { request, result } = data as SrvxRequestData;
  const method = request.method;
  const path = new URL(request.url).pathname;
  const attributes: IKeyValue[] = [
    { key: "nitro.channel", value: { stringValue: channel } },
    { key: "http.request.method", value: { stringValue: method } },
    { key: "url.path", value: { stringValue: path } },
  ];
  if (result) {
    attributes.push({ key: "http.response.status_code", value: { intValue: result.status } });
  }
  return { name: `${method} ${path}`, kind: SPAN_KIND_INTERNAL, attributes };
}

/** srvx's `RequestEvent` (channel `srvx.middleware`); handler name may be empty. */
interface SrvxMiddlewareData {
  request: { method: string };
  middleware: { index: number; handler: { name: string } };
}

function describeSrvxMiddleware(channel: string, data: unknown): SpanInfo {
  const { request, middleware } = data as SrvxMiddlewareData;
  const handlerName = middleware.handler.name;
  const attributes: IKeyValue[] = [
    { key: "nitro.channel", value: { stringValue: channel } },
    { key: "nitro.middleware.index", value: { intValue: middleware.index } },
    { key: "http.request.method", value: { stringValue: request.method } },
  ];
  if (handlerName) {
    attributes.push({ key: "nitro.middleware.name", value: { stringValue: handlerName } });
  }
  return {
    name: `middleware ${handlerName || `#${middleware.index}`}`,
    kind: SPAN_KIND_INTERNAL,
    attributes,
  };
}

/** unstorage's tracing payload (channels `unstorage.*`); driver/base optional. */
interface UnstorageData {
  driver?: { name?: string };
  base?: string;
  keys?: unknown[];
}

function describeUnstorage(channel: string, data: unknown): SpanInfo {
  const { driver, base, keys } = data as UnstorageData;
  const operation = channel.slice("unstorage.".length);
  // CLIENT: storage is a known outbound dependency (OTEL database semconv).
  const attributes: IKeyValue[] = [
    { key: "nitro.channel", value: { stringValue: channel } },
    { key: "db.operation", value: { stringValue: operation } },
  ];
  if (driver?.name) attributes.push({ key: "db.system", value: { stringValue: driver.name } });
  if (base) attributes.push({ key: "nitro.storage.base", value: { stringValue: base } });
  if (keys) attributes.push({ key: "nitro.storage.keys_count", value: { intValue: keys.length } });
  return { name: base ? `${operation} ${base}` : operation, kind: SPAN_KIND_CLIENT, attributes };
}

// Patch `tracingChannel` once, even if the plugin initialises more than once.
let patched = false;

export default definePlugin(() => {
  const diagnostics = globalThis.process?.getBuiltinModule?.("node:diagnostics_channel");
  if (!diagnostics?.tracingChannel || patched) return;
  patched = true;

  const { tracingChannel: createTracingChannel } = diagnostics;
  const instrumented = new Set<string>();

  const instrument = (name: unknown, channel: TracingChannel<Record<string, unknown>>): void => {
    if (typeof name !== "string" || instrumented.has(name)) return;
    instrumented.add(name);

    // Carry the start time from `start` to `asyncEnd` without mutating the producer's context object.
    const starts = new WeakMap<object, string>();

    channel.subscribe({
      start(message) {
        starts.set(message, Span.nowUnixNano());
      },
      end() {},
      asyncStart() {},
      error() {},
      asyncEnd(message) {
        try {
          const start = starts.get(message);
          if (start === undefined) return;
          starts.delete(message);

          // Derive span name, kind and semantic attributes from the operation.
          // First-party channels (h3/srvx/unstorage) map to OpenTelemetry
          // semantic conventions; unknown/third-party channels — and any
          // describer that throws on a malformed payload — degrade to a generic
          // INTERNAL span named after the channel (OTLP's default kind: no
          // remote relationship established), so enrichment never drops a span.
          const describe =
            CHANNEL_DESCRIBERS[name] ??
            PREFIX_DESCRIBERS.find((entry) => name.startsWith(entry.prefix))?.describe;
          let info: SpanInfo | undefined;
          if (describe) {
            try {
              info = describe(name, message);
            } catch {
              // Fall through to the generic span below.
            }
          }
          info ??= {
            name,
            kind: SPAN_KIND_INTERNAL,
            attributes: [{ key: "nitro.channel", value: { stringValue: name } }],
          };

          reportSpan(info, start, message.error);
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
    instrument(nameOrChannels, channel as TracingChannel<Record<string, unknown>>);
    return channel;
  }) as CreateTracingChannel;
});

/** An OTEL `exception` span event derived from a thrown error and its message. */
function exceptionEvent(
  err: Partial<Error> | undefined,
  message: string,
  timeUnixNano: string
): ISpanEvent {
  const attributes: IKeyValue[] = [];
  if (typeof err?.name === "string") {
    attributes.push({ key: "exception.type", value: { stringValue: err.name } });
  }
  attributes.push({ key: "exception.message", value: { stringValue: message } });
  if (typeof err?.stack === "string") {
    attributes.push({ key: "exception.stacktrace", value: { stringValue: err.stack } });
  }
  return { timeUnixNano, name: "exception", attributes, droppedAttributesCount: 0 };
}
