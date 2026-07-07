import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { TracingChannel } from "node:diagnostics_channel";
import type {
  IExportTraceServiceRequest,
  IKeyValue,
  ISpan,
} from "../../src/presets/vercel/runtime/telemetry/types.ts";

vi.mock("nitro", () => ({ definePlugin: (def: unknown) => def }));

import telemetryPlugin from "../../src/presets/vercel/runtime/telemetry/vercel.ts";

const diagnostics = process.getBuiltinModule("node:diagnostics_channel");

const REQUEST_CONTEXT_SYMBOL = Symbol.for("@vercel/request-context");

// OTLP wire values (proto enums) — NOT `@opentelemetry/api`'s `SpanKind`
// (which is off by one: its INTERNAL = 0).
const KIND_INTERNAL = 1;
const KIND_CLIENT = 3;
const STATUS_ERROR = 2;

// ---------------------------------------------------------------------------
// Vercel runtime simulation
// ---------------------------------------------------------------------------

interface Harness {
  reports: IExportTraceServiceRequest[];
  tasks: Array<() => Promise<unknown>>;
  traceId: string;
  rootSpanId: string;
  /** Run the buffered `waitUntil` tasks (the runtime does this at freeze time). */
  flush: () => Promise<void>;
}

/**
 * Installs a fake `globalThis[Symbol.for("@vercel/request-context")]` reader,
 * mirroring the per-request context object the Vercel Node runtime exposes
 * (see vercel/functions `packages/request-context-storage`).
 */
function installVercelContext(
  options: { traceFlags?: number; telemetry?: boolean; rootSpanContext?: boolean } = {}
): Harness {
  const reports: IExportTraceServiceRequest[] = [];
  const tasks: Array<() => Promise<unknown>> = [];
  const traceId = randomHex(32);
  const rootSpanId = randomHex(16);

  const telemetry =
    options.telemetry === false
      ? undefined
      : {
          reportSpans(data: IExportTraceServiceRequest) {
            reports.push(data);
          },
          rootSpanContext:
            options.rootSpanContext === false
              ? undefined
              : {
                  traceId,
                  spanId: rootSpanId,
                  ...(options.traceFlags === undefined ? {} : { traceFlags: options.traceFlags }),
                },
        };

  const context = {
    telemetry,
    waitUntil(task: (() => Promise<unknown>) | Promise<unknown>) {
      tasks.push(typeof task === "function" ? task : () => task);
    },
  };

  (globalThis as Record<symbol, unknown>)[REQUEST_CONTEXT_SYMBOL] = { get: () => context };

  return {
    reports,
    tasks,
    traceId,
    rootSpanId,
    flush: async () => {
      for (const task of tasks) {
        await task();
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Strict payload validation, mirroring the Vercel runtime deserializer
// ---------------------------------------------------------------------------

/**
 * Re-implements the serde schema validation Vercel applies to `reportSpans` payloads
 */
function validateVercelPayload(data: IExportTraceServiceRequest): void {
  // The IPC message is JSON, NULL-delimited (`MessageCodec`). BigInt values
  // would throw in JSON.stringify; a NUL byte would corrupt message framing.
  const json = JSON.stringify({ type: "otel-spans", payload: data });
  expect(json).not.toContain("\u0000");

  // OtelSpansMessage { resource_spans: Option<Vec<ResourceSpans>> }
  expect(Array.isArray(data.resourceSpans)).toBe(true);
  for (const resourceSpans of data.resourceSpans!) {
    // Resource { attributes: Vec<KeyValue> } — required when `resource` is set
    if (resourceSpans.resource != null) {
      validateKeyValues(resourceSpans.resource.attributes);
    }
    // ResourceSpans.scope_spans: Vec<ScopeSpans> — required
    expect(Array.isArray(resourceSpans.scopeSpans)).toBe(true);
    for (const scopeSpans of resourceSpans.scopeSpans) {
      // InstrumentationScope { name: String } — required when `scope` is set
      if (scopeSpans.scope != null) {
        expect(typeof scopeSpans.scope.name).toBe("string");
      }
      // ScopeSpans.spans: Vec<OtlpSpan> — required
      expect(Array.isArray(scopeSpans.spans)).toBe(true);
      for (const span of scopeSpans.spans!) {
        validateSpan(span);
      }
    }
  }
}

function validateSpan(span: ISpan): void {
  // TraceId/SpanId parse as u128/u64 from hex
  // 32/16 lowercase hex chars, never the all-zero sentinel.
  expect(span.traceId).toMatch(/^[0-9a-f]{32}$/);
  expect(span.traceId).not.toBe("0".repeat(32));
  expect(span.spanId).toMatch(/^[0-9a-f]{16}$/);
  expect(span.spanId).not.toBe("0".repeat(16));
  if (span.parentSpanId !== undefined) {
    expect(span.parentSpanId).toMatch(/^[0-9a-f]{16}$/);
  }

  expect(typeof span.name).toBe("string");

  // SpanKind is #[repr(u8)] 0..=5 — must be the OTLP wire value, as a number.
  expect([0, 1, 2, 3, 4, 5]).toContain(span.kind);

  validateUnixNano(span.startTimeUnixNano);
  validateUnixNano(span.endTimeUnixNano);
  expect(BigInt(span.startTimeUnixNano)).toBeLessThanOrEqual(BigInt(span.endTimeUnixNano));

  // OtlpSpan.attributes / OtlpSpan.events: Vec<_> — required even when empty.
  // Omitting `events` was the live failure mode ("missing field 'events'").
  validateKeyValues(span.attributes);
  expect(Array.isArray(span.events)).toBe(true);
  for (const event of span.events!) {
    validateUnixNano(event.timeUnixNano);
    expect(typeof event.name).toBe("string");
    validateKeyValues(event.attributes);
  }

  // Additional fields the live runtime required present even when empty
  // (verified on real Vercel — see the handoff notes in PR #4355).
  for (const key of [
    "traceState",
    "droppedAttributesCount",
    "droppedEventsCount",
    "droppedLinksCount",
    "links",
    "status",
  ]) {
    expect(span, `span.${key} must be present`).toHaveProperty(key);
  }
  expect(typeof span.status!.code).toBe("number");
  expect(typeof span.status!.message).toBe("string");
}

/** `UnixNano` deserializes as `Int(usize)` or `Str` parseable as usize. */
function validateUnixNano(value: unknown): void {
  if (typeof value === "string") {
    expect(value).toMatch(/^\d+$/);
  } else {
    expect(Number.isInteger(value)).toBe(true);
    expect(value as number).toBeGreaterThanOrEqual(0);
  }
}

const ANY_VALUE_VARIANTS = new Set([
  "stringValue",
  "boolValue",
  "intValue",
  "doubleValue",
  "arrayValue",
  "kvlistValue",
  "bytesValue",
]);

function validateKeyValues(attributes: unknown): void {
  expect(Array.isArray(attributes)).toBe(true);
  for (const { key, value } of attributes as IKeyValue[]) {
    expect(typeof key).toBe("string");
    // AnyValue is an externally-tagged serde enum: exactly one variant key.
    const keys = Object.keys(value);
    expect(keys, `attribute ${key} must have exactly one AnyValue variant`).toHaveLength(1);
    const variant = keys[0];
    expect(ANY_VALUE_VARIANTS).toContain(variant);
    const inner = (value as Record<string, unknown>)[variant];
    if (inner !== null) {
      if (variant === "stringValue") expect(typeof inner).toBe("string");
      if (variant === "boolValue") expect(typeof inner).toBe("boolean");
      if (variant === "intValue") expect(Number.isInteger(inner)).toBe(true); // i64
      if (variant === "doubleValue") expect(typeof inner).toBe("number"); // f64
    }
  }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function randomHex(chars: number): string {
  let hex = "";
  while (hex.length < chars) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return hex.replaceAll("0", "1"); // never the all-zero sentinel
}

let channelCounter = 0;
function uniqueChannel(): string {
  return `nitro.test.op${++channelCounter}`;
}

/** Run one traced operation the way producers (h3/srvx/unstorage) do. */
function traced(
  channelName: string,
  data: Record<string, unknown>,
  fn: () => Promise<unknown> = async () => "ok"
): Promise<unknown> {
  const channel = diagnostics.tracingChannel(channelName) as TracingChannel<
    Record<string, unknown>
  >;
  return channel.tracePromise(fn, data);
}

async function flushSpans(harness: Harness): Promise<ISpan[]> {
  await harness.flush();
  const spans: ISpan[] = [];
  for (const report of harness.reports) {
    validateVercelPayload(report);
    for (const resourceSpans of report.resourceSpans!) {
      for (const scopeSpans of resourceSpans.scopeSpans) {
        spans.push(...scopeSpans.spans!);
      }
    }
  }
  return spans;
}

function attrValue(span: ISpan, key: string): unknown {
  return span.attributes!.find((attribute) => attribute.key === key)?.value;
}

// ---------------------------------------------------------------------------
// Setup: activate the plugin once (it patches `tracingChannel` process-wide)
// ---------------------------------------------------------------------------

const originalTracingChannel = diagnostics.tracingChannel;

beforeAll(() => {
  (telemetryPlugin as unknown as () => void)();
});

afterAll(() => {
  diagnostics.tracingChannel = originalTracingChannel;
});

afterEach(() => {
  delete (globalThis as Record<symbol, unknown>)[REQUEST_CONTEXT_SYMBOL];
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("vercel telemetry plugin", () => {
  it("reports a schema-valid OTLP batch joined to the platform root span", async () => {
    const harness = installVercelContext();
    const channel = uniqueChannel();

    const before = (BigInt(Date.now()) - 5000n) * 1_000_000n;
    await traced(channel, {});
    const after = (BigInt(Date.now()) + 5000n) * 1_000_000n;

    const spans = await flushSpans(harness);
    expect(spans).toHaveLength(1);

    const span = spans[0];
    expect(span.traceId).toBe(harness.traceId);
    expect(span.parentSpanId).toBe(harness.rootSpanId);
    expect(span.spanId).not.toBe(harness.rootSpanId);
    expect(span.name).toBe(channel);
    expect(span.kind).toBe(KIND_INTERNAL);
    expect(span.status).toEqual({ code: 0, message: "" });
    expect(span.events).toEqual([]);

    // Timestamps are unix-nanosecond strings (BigInt-safe, no precision loss).
    expect(typeof span.startTimeUnixNano).toBe("string");
    expect(typeof span.endTimeUnixNano).toBe("string");
    expect(BigInt(span.startTimeUnixNano)).toBeGreaterThanOrEqual(before);
    expect(BigInt(span.endTimeUnixNano)).toBeLessThanOrEqual(after);

    const scopeSpans = harness.reports[0].resourceSpans![0].scopeSpans[0];
    expect(scopeSpans.scope?.name).toBe("@nitro/vercel-tracing");
  });

  it("batches all spans of a request into a single reportSpans call", async () => {
    const harness = installVercelContext();
    await traced(uniqueChannel(), {});
    await traced(uniqueChannel(), {});
    await traced(uniqueChannel(), {});

    // One flush scheduled for the whole request, one IPC message.
    expect(harness.tasks).toHaveLength(1);
    const spans = await flushSpans(harness);
    expect(harness.reports).toHaveLength(1);
    expect(spans).toHaveLength(3);
    expect(new Set(spans.map((span) => span.traceId))).toEqual(new Set([harness.traceId]));
  });

  it("flush is idempotent (buffer cleared after reporting)", async () => {
    const harness = installVercelContext();
    await traced(uniqueChannel(), {});
    await harness.flush();
    await harness.flush();
    expect(harness.reports).toHaveLength(1);
  });

  it("buffers concurrent requests independently by trace id", async () => {
    const channel = uniqueChannel();
    const first = installVercelContext();
    await traced(channel, {});
    const second = installVercelContext();
    await traced(channel, {});

    const firstSpans = await flushSpans(first);
    const secondSpans = await flushSpans(second);
    expect(firstSpans).toHaveLength(1);
    expect(firstSpans[0].traceId).toBe(first.traceId);
    expect(secondSpans).toHaveLength(1);
    expect(secondSpans[0].traceId).toBe(second.traceId);
  });

  it("does not break traced operations when no request context exists", async () => {
    await expect(traced(uniqueChannel(), {})).resolves.toBe("ok");
  });

  it("reports nothing without telemetry or rootSpanContext", async () => {
    const noTelemetry = installVercelContext({ telemetry: false });
    await traced(uniqueChannel(), {});
    expect(noTelemetry.tasks).toHaveLength(0);

    const noRoot = installVercelContext({ rootSpanContext: false });
    await traced(uniqueChannel(), {});
    expect(noRoot.tasks).toHaveLength(0);
  });

  it("respects the platform sampling decision (traceFlags bit 0)", async () => {
    const unsampled = installVercelContext({ traceFlags: 0 });
    await traced(uniqueChannel(), {});
    expect(unsampled.tasks).toHaveLength(0);

    const sampled = installVercelContext({ traceFlags: 1 });
    await traced(uniqueChannel(), {});
    expect(await flushSpans(sampled)).toHaveLength(1);
  });
});

describe("vercel telemetry error reporting", () => {
  it("records rejected operations as error status + OTEL exception event", async () => {
    const harness = installVercelContext();
    const error = new Error("boom");
    await expect(
      traced(uniqueChannel(), {}, async () => {
        throw error;
      })
    ).rejects.toThrow("boom");

    const [span] = await flushSpans(harness);
    expect(span.status).toEqual({ code: STATUS_ERROR, message: "boom" });
    expect(span.events).toHaveLength(1);

    const event = span.events![0];
    expect(event.name).toBe("exception");
    expect(event.timeUnixNano).toBe(span.endTimeUnixNano);
    expect(event.attributes).toEqual([
      { key: "exception.type", value: { stringValue: "Error" } },
      { key: "exception.message", value: { stringValue: "boom" } },
      { key: "exception.stacktrace", value: { stringValue: error.stack } },
    ]);
  });

  it("handles non-Error rejections", async () => {
    const harness = installVercelContext();
    await expect(
      traced(uniqueChannel(), {}, async () => {
        throw "plain failure";
      })
    ).rejects.toBe("plain failure");

    const [span] = await flushSpans(harness);
    expect(span.status).toEqual({ code: STATUS_ERROR, message: "plain failure" });
    expect(span.events![0].attributes).toEqual([
      { key: "exception.message", value: { stringValue: "plain failure" } },
    ]);
  });
});

describe("vercel telemetry span describers", () => {
  it("describes h3.request route and middleware events", async () => {
    const harness = installVercelContext();
    const event = { req: { method: "GET" }, url: { pathname: "/storage" } };
    await traced("h3.request", { type: "route", event });
    await traced("h3.request", { type: "middleware", event });

    const spans = await flushSpans(harness);
    expect(spans.map((span) => span.name)).toEqual(["GET /storage", "middleware GET /storage"]);
    expect(spans[0].kind).toBe(KIND_INTERNAL);
    expect(attrValue(spans[0], "nitro.channel")).toEqual({ stringValue: "h3.request" });
    expect(attrValue(spans[0], "http.request.method")).toEqual({ stringValue: "GET" });
    expect(attrValue(spans[0], "url.path")).toEqual({ stringValue: "/storage" });
    expect(attrValue(spans[0], "nitro.h3.handler_type")).toEqual({ stringValue: "route" });
    expect(attrValue(spans[1], "nitro.h3.handler_type")).toEqual({ stringValue: "middleware" });
  });

  it("describes srvx.request with the response status", async () => {
    const harness = installVercelContext();
    // `tracePromise` sets `result` on the context when the promise resolves,
    // which is how srvx exposes the response.
    await traced(
      "srvx.request",
      { request: { method: "POST", url: "https://example.com/api/hello?x=1" } },
      async () => ({ status: 201 })
    );

    const [span] = await flushSpans(harness);
    expect(span.name).toBe("POST /api/hello");
    expect(span.kind).toBe(KIND_INTERNAL);
    expect(attrValue(span, "url.path")).toEqual({ stringValue: "/api/hello" });
    expect(attrValue(span, "http.response.status_code")).toEqual({ intValue: 201 });
  });

  it("describes srvx.middleware with named and anonymous handlers", async () => {
    const harness = installVercelContext();
    const request = { method: "GET" };
    await traced("srvx.middleware", {
      request,
      middleware: { index: 2, handler: { name: "auth" } },
    });
    await traced("srvx.middleware", { request, middleware: { index: 0, handler: { name: "" } } });

    const spans = await flushSpans(harness);
    expect(spans.map((span) => span.name)).toEqual(["middleware auth", "middleware #0"]);
    expect(attrValue(spans[0], "nitro.middleware.index")).toEqual({ intValue: 2 });
    expect(attrValue(spans[0], "nitro.middleware.name")).toEqual({ stringValue: "auth" });
    expect(attrValue(spans[1], "nitro.middleware.name")).toBeUndefined();
  });

  it("describes dynamic unstorage.* channels as CLIENT spans", async () => {
    const harness = installVercelContext();
    await traced("unstorage.getItem", {
      driver: { name: "redis" },
      base: "cache",
      keys: ["a", "b"],
    });
    await traced("unstorage.setItem", {});

    const spans = await flushSpans(harness);
    expect(spans[0].name).toBe("getItem cache");
    // OTLP wire value CLIENT = 3 (NOT @opentelemetry/api's SpanKind.CLIENT = 2).
    expect(spans[0].kind).toBe(KIND_CLIENT);
    expect(attrValue(spans[0], "db.operation")).toEqual({ stringValue: "getItem" });
    expect(attrValue(spans[0], "db.system")).toEqual({ stringValue: "redis" });
    expect(attrValue(spans[0], "nitro.storage.base")).toEqual({ stringValue: "cache" });
    expect(attrValue(spans[0], "nitro.storage.keys_count")).toEqual({ intValue: 2 });
    expect(spans[1].name).toBe("setItem");
  });

  it("emits a generic INTERNAL span for unknown channels", async () => {
    const harness = installVercelContext();
    await traced("ioredis:command", { command: { name: "GET" } });

    const [span] = await flushSpans(harness);
    expect(span.name).toBe("ioredis:command");
    expect(span.kind).toBe(KIND_INTERNAL);
    expect(span.attributes).toEqual([
      { key: "nitro.channel", value: { stringValue: "ioredis:command" } },
    ]);
  });

  it("degrades to a generic span on malformed payloads without breaking the operation", async () => {
    const harness = installVercelContext();
    // Missing `event` — the h3 describer throws and must be swallowed.
    await expect(traced("h3.request", { type: "route" })).resolves.toBe("ok");

    const [span] = await flushSpans(harness);
    expect(span.name).toBe("h3.request");
    expect(span.attributes).toEqual([
      { key: "nitro.channel", value: { stringValue: "h3.request" } },
    ]);
  });
});

describe("vercel telemetry instrumentation", () => {
  it("subscribes once per channel name even if the channel is re-created", async () => {
    const harness = installVercelContext();
    const channel = uniqueChannel();
    diagnostics.tracingChannel(channel);
    diagnostics.tracingChannel(channel);
    await traced(channel, {});
    expect(await flushSpans(harness)).toHaveLength(1);
  });

  it("does not double-instrument when the plugin initialises twice", async () => {
    (telemetryPlugin as unknown as () => void)();
    const harness = installVercelContext();
    await traced(uniqueChannel(), {});
    expect(await flushSpans(harness)).toHaveLength(1);
  });
});
