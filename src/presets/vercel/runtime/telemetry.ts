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
  events: never[] = [];
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
    this.status =
      error === undefined
        ? { code: 0, message: "" }
        : { code: STATUS_CODE_ERROR, message: errorMessage(error) };
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

function reportSpan(info: SpanInfo, startTimeUnixNano: string, error: unknown): void {
  const telemetry = getTelemetry();
  const root = telemetry?.rootSpanContext;

  // Without a platform root span there is no trace to join
  // The runtime correlates spans to the request by trace id and drops the rest
  if (!root) return;

  // Respect the platform sampling decision (bit 0 of traceFlags).
  if (root.traceFlags !== undefined && (root.traceFlags & 1) === 0) return;

  const span = new Span(root.traceId, root.spanId, info, startTimeUnixNano, error);

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

/** Maps a completed channel operation to a span name, kind and attributes. */
type ChannelDescriber = (channel: string, data: Record<string, unknown>) => SpanInfo;

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

/**
 * Derive a span name, kind and semantic attributes from a completed operation.
 *
 * First-party channels (h3/srvx/unstorage) map to OpenTelemetry semantic
 * conventions. Unknown/third-party channels — and any describer that throws on a
 * malformed payload — degrade to a generic INTERNAL span named after the
 * channel, so enrichment is best-effort and never drops a span.
 */
function describeSpan(channel: string, data: Record<string, unknown>): SpanInfo {
  const describe =
    CHANNEL_DESCRIBERS[channel] ??
    PREFIX_DESCRIBERS.find((entry) => channel.startsWith(entry.prefix))?.describe;

  if (describe) {
    try {
      return describe(channel, data);
    } catch {
      // Fall through to the generic span below.
    }
  }

  // OTLP's default kind: we have not established a remote relationship.
  return { name: channel, kind: SPAN_KIND_INTERNAL, attributes: [attr("nitro.channel", channel)] };
}

function describeH3Request(channel: string, data: Record<string, unknown>): SpanInfo {
  const attributes = [attr("nitro.channel", channel)];
  const event = asRecord(data.event);
  const method = asString(asRecord(event?.req)?.method);
  const path = asString(asRecord(event?.url)?.pathname);
  const type = asString(data.type);
  if (method) attributes.push(attr("http.request.method", method));
  if (path) attributes.push(attr("url.path", path));
  if (type) attributes.push(attr("nitro.h3.handler_type", type));
  const name = label(type === "middleware" ? "middleware" : undefined, method, path) || channel;
  return { name, kind: SPAN_KIND_INTERNAL, attributes };
}

function describeSrvxRequest(channel: string, data: Record<string, unknown>): SpanInfo {
  const attributes = [attr("nitro.channel", channel)];
  const request = asRecord(data.request);
  const method = asString(request?.method);
  const path = urlPath(asString(request?.url));
  const status = asNumber(asRecord(data.result)?.status);
  if (method) attributes.push(attr("http.request.method", method));
  if (path) attributes.push(attr("url.path", path));
  if (status !== undefined) attributes.push(attr("http.response.status_code", status));
  return { name: label(method, path) || channel, kind: SPAN_KIND_INTERNAL, attributes };
}

function describeSrvxMiddleware(channel: string, data: Record<string, unknown>): SpanInfo {
  const attributes = [attr("nitro.channel", channel)];
  const middleware = asRecord(data.middleware);
  const index = asNumber(middleware?.index);
  const middlewareName = asString(asRecord(middleware?.handler)?.name);
  const method = asString(asRecord(data.request)?.method);
  if (index !== undefined) attributes.push(attr("nitro.middleware.index", index));
  if (middlewareName) attributes.push(attr("nitro.middleware.name", middlewareName));
  if (method) attributes.push(attr("http.request.method", method));
  const name = label(
    "middleware",
    middlewareName ?? (index === undefined ? undefined : `#${index}`)
  );
  return { name, kind: SPAN_KIND_INTERNAL, attributes };
}

function describeUnstorage(channel: string, data: Record<string, unknown>): SpanInfo {
  const attributes = [attr("nitro.channel", channel)];
  const operation = channel.slice("unstorage.".length);
  const driver = asString(asRecord(data.driver)?.name);
  const base = asString(data.base);
  const keys = Array.isArray(data.keys) ? data.keys.length : undefined;
  // CLIENT: storage is a known outbound dependency (OTEL database semconv).
  attributes.push(attr("db.operation", operation));
  if (driver) attributes.push(attr("db.system", driver));
  if (base) attributes.push(attr("nitro.storage.base", base));
  if (keys !== undefined) attributes.push(attr("nitro.storage.keys_count", keys));
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

  const instrument = (
    name: unknown,
    channel: TracingChannel<unknown, Record<string, unknown>>
  ): void => {
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
          // This reports one span per IPC message. TODO: for high span-count
          // requests, batch spans per request and flush once (via `waitUntil`) to
          // cut IPC overhead as `@vercel/otel` does with its BatchSpanProcessor.
          reportSpan(describeSpan(name, message), start, message.error);
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

/** Build an OTLP key/value, mapping JS types to the matching OTLP `AnyValue` field. */
function attr(key: string, value: string | number | boolean): IKeyValue {
  if (typeof value === "number") {
    return { key, value: Number.isInteger(value) ? { intValue: value } : { doubleValue: value } };
  }
  if (typeof value === "boolean") {
    return { key, value: { boolValue: value } };
  }
  return { key, value: { stringValue: value } };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function urlPath(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).pathname;
  } catch {
    return undefined;
  }
}

function label(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function errorMessage(error: unknown): string {
  const message = asRecord(error)?.message;
  return typeof message === "string" ? message : String(error);
}
