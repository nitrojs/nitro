/**
 * Minimal OpenTelemetry / OTLP type surface for the Vercel telemetry plugin.
 *
 * Hand-rolled (vendored) so the plugin pulls in no `@opentelemetry/*` package
 * at build time. This mirrors what Vercel's own no-SDK runtime util does:
 * `@vercel/otel-runtime`'s `src/types.ts` likewise copies these from upstream
 * rather than importing them.
 *
 * Trimmed to the subset the Vercel telemetry IPC requires. Re-sync from upstream
 * if the OTLP shape changes:
 *  - OTLP trace types — `@opentelemetry/otlp-transformer`:
 *    https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/otlp-transformer/src/trace/internal-types.ts
 *  - OTLP common types (`IKeyValue`/`IAnyValue`) — `@opentelemetry/otlp-transformer`:
 *    https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/otlp-transformer/src/common/internal-types.ts
 *  - `SpanContext` — `@opentelemetry/api`:
 *    https://github.com/open-telemetry/opentelemetry-js/blob/5954fdeb908ca2123c8dd6e9d51958147b434618/api/src/trace/span_context.ts#L25
 */

/** OTLP `ExportTraceServiceRequest` — the payload `reportSpans` accepts. */
export interface IExportTraceServiceRequest {
  resourceSpans?: IResourceSpans[];
}

interface IResourceSpans {
  resource?: IResource;
  scopeSpans: IScopeSpans[];
  schemaUrl?: string;
}

interface IResource {
  attributes: IKeyValue[];
  droppedAttributesCount?: number;
}

interface IScopeSpans {
  scope?: IInstrumentationScope;
  spans?: ISpan[];
  schemaUrl?: string | null;
}

interface IInstrumentationScope {
  name: string;
  version?: string;
  attributes?: IKeyValue[];
  droppedAttributesCount?: number;
}

export interface ISpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  // OTLP defines a numeric SpanKind enum (INTERNAL = 1, CLIENT = 3, …); we emit
  // the wire value directly, so this is `number` rather than a vendored enum.
  kind: number;
  // OTLP `*UnixNano` fields are 64-bit; over this IPC they are sent as
  // unix-nanosecond strings (BigInt-safe), so we narrow to `string`.
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes?: IKeyValue[];
  droppedAttributesCount?: number;
  events?: ISpanEvent[];
  droppedEventsCount?: number;
  // Always emitted empty by this plugin, so the element type is irrelevant.
  links?: unknown[];
  droppedLinksCount?: number;
  traceState?: string | null;
  // OTLP status code enum: UNSET = 0, OK = 1, ERROR = 2.
  status?: { message?: string; code: number };
}

/** OTLP span `Event` — e.g. a recorded `exception` (type/message/stacktrace). */
export interface ISpanEvent {
  timeUnixNano: string;
  name: string;
  attributes: IKeyValue[];
  droppedAttributesCount?: number;
}

export interface IKeyValue {
  key: string;
  value: IAnyValue;
}

interface IAnyValue {
  stringValue?: string | null;
  boolValue?: boolean | null;
  intValue?: number | null;
  doubleValue?: number | null;
}

/**
 * Subset of `@opentelemetry/api`'s `SpanContext` — the per-request root the
 * Vercel runtime exposes via `telemetry.rootSpanContext`.
 */
export interface SpanContext {
  traceId: string;
  spanId: string;
  /** Trace flags bitmap; bit 0 is the sampled flag. */
  traceFlags?: number;
}
