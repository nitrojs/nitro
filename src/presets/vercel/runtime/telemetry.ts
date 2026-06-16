import { definePlugin } from "nitro";

/**
 * Exports Nitro tracing-channel events to the Vercel runtime as OpenTelemetry
 * spans, without an OpenTelemetry SDK.
 *
 * Subscribes to every Node `tracingChannel` a producer (h3, srvx, unstorage, …)
 * creates and reports a full OTLP span per completed operation.
 */

const REQUEST_CONTEXT_SYMBOL = Symbol.for("@vercel/request-context");

// OTLP: span kind 1 = INTERNAL, status code 2 = ERROR.
const SPAN_KIND_INTERNAL = 1;
const STATUS_CODE_ERROR = 2;
const SCOPE_NAME = "@nitro/vercel-tracing";

function getTelemetry(): any {
  return (globalThis as any)[REQUEST_CONTEXT_SYMBOL]?.get?.()?.telemetry;
}

/** Wall-clock nanoseconds as a string, as required by OTLP `*UnixNano` fields. */
function nowUnixNano(): string {
  const ms = performance.timeOrigin + performance.now();
  return (BigInt(Math.trunc(ms)) * 1_000_000n + BigInt(Math.round((ms % 1) * 1e6))).toString();
}

/** 8 random bytes, hex-encoded — an OTLP span id (never the all-zero sentinel). */
function randomSpanId(): string {
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0");
  }
  return id === "0000000000000000" ? "0000000000000001" : id;
}

function reportSpan(channel: string, startTimeUnixNano: string, error?: unknown): void {
  const telemetry = getTelemetry();
  const root = telemetry?.rootSpanContext;

  // Without a platform root span there is no trace to join
  // The runtime correlates spans to the request by trace id and drops the rest
  if (!root) return;

  // Respect the platform sampling decision (bit 0 of traceFlags).
  if (root.traceFlags !== undefined && (root.traceFlags & 1) === 0) return;

  // The Vercel runtime deserializes spans against a strict OTLP schema, so
  // every field must be present even when empty (omitting e.g. `events` or
  // `attributes` makes the runtime drop the whole batch).
  const span = {
    traceId: root.traceId,
    spanId: randomSpanId(),
    traceState: "",
    // Parent every span on the platform root (flat siblings).
    parentSpanId: root.spanId,
    name: channel,
    kind: SPAN_KIND_INTERNAL,
    startTimeUnixNano,
    endTimeUnixNano: nowUnixNano(),
    attributes: [{ key: "nitro.channel", value: { stringValue: channel } }],
    droppedAttributesCount: 0,
    events: [],
    droppedEventsCount: 0,
    links: [],
    droppedLinksCount: 0,
    status:
      error === undefined
        ? { code: 0, message: "" }
        : { code: STATUS_CODE_ERROR, message: String((error as any)?.message ?? error) },
  };

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

export default definePlugin(() => {
  const diagnostics: any = globalThis.process?.getBuiltinModule?.("node:diagnostics_channel");
  if (!diagnostics?.tracingChannel) return;
  // Avoid double-wrapping if the plugin is initialised more than once.
  if (diagnostics.__nitroTracingWrapped) return;

  const createTracingChannel = diagnostics.tracingChannel;
  const instrumented = new Set<string>();

  const instrument = (name: unknown, channel: any) => {
    if (typeof name !== "string" || instrumented.has(name)) return;
    instrumented.add(name);

    // Carry the start time from `start` to `asyncEnd` without mutating the producer's context object.
    const starts = new WeakMap<object, string>();

    channel.subscribe({
      start(data: any) {
        starts.set(data, nowUnixNano());
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
  const wrapped = (nameOrChannels: any) => {
    const channel = createTracingChannel.apply(diagnostics, [nameOrChannels]);
    instrument(nameOrChannels, channel);
    return channel;
  };
  diagnostics.__nitroTracingWrapped = true;
  diagnostics.tracingChannel = wrapped;
});
