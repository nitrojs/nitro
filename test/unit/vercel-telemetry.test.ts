import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { TracingChannel } from "node:diagnostics_channel";
import type {
  IExportTraceServiceRequest,
  IKeyValue,
  ISpan,
} from "../../src/presets/vercel/runtime/telemetry/types.ts";

vi.mock("nitro", () => ({ definePlugin: (def: unknown) => def }));

import telemetryPlugin from "../../src/presets/vercel/runtime/telemetry/plugin.ts";

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

// The plugin only traces channels declared in `TRACED_CHANNELS`. Tests that
// exercise span buffering/reporting (not a specific describer) drive this
// declared channel; `{}` is a valid `unstorage.*` payload → a CLIENT span.
const KNOWN_CHANNEL = "unstorage.setItem";
function traceKnown(fn?: () => Promise<unknown>): Promise<unknown> {
  return traced(KNOWN_CHANNEL, {}, fn);
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

/**
 * Trace one or more ops in a single fresh request and return the reported spans.
 * For tests that only assert on the resulting spans — not on harness internals
 * (`traceId`/`reports`/`tasks`) or the traced promise's own outcome.
 */
async function traceSpans(...ops: Array<Parameters<typeof traced>>): Promise<ISpan[]> {
  const harness = installVercelContext();
  for (const op of ops) {
    await traced(...op);
  }
  return flushSpans(harness);
}

// ---------------------------------------------------------------------------
// Setup: activate the plugin once (it subscribes to the traced channels
// process-wide via `diagnostics_channel.subscribe`; no globals are patched).
// ---------------------------------------------------------------------------

const originalTracingChannel = diagnostics.tracingChannel;

beforeAll(() => {
  (telemetryPlugin as unknown as () => void)();
});

afterEach(() => {
  delete (globalThis as Record<symbol, unknown>)[REQUEST_CONTEXT_SYMBOL];
});

// ---------------------------------------------------------------------------
// Tests
//
// One `describe` per source section, in source order:
//   1. Span class        (plugin.ts)   — OTLP payload shape + error/exception events
//   2. reportSpan         (plugin.ts)   — per-request buffering, reporting, sampling, guards
//   3. channel describers (channels.ts) — name/kind/attributes per producer
//   4. subscription       (plugin.ts)   — channel subscription without patching globals
// ---------------------------------------------------------------------------

// 1. Span class (plugin.ts) — the OTLP span each completed operation produces.
describe("vercel telemetry span payload", () => {
  it("reports a schema-valid OTLP batch joined to the platform root span", async () => {
    const harness = installVercelContext();

    const before = (BigInt(Date.now()) - 5000n) * 1_000_000n;
    await traceKnown();
    const after = (BigInt(Date.now()) + 5000n) * 1_000_000n;

    const spans = await flushSpans(harness);
    expect(spans).toHaveLength(1);

    const span = spans[0];
    expect(span.traceId).toBe(harness.traceId);
    expect(span.parentSpanId).toBe(harness.rootSpanId);
    expect(span.spanId).not.toBe(harness.rootSpanId);
    expect(span.name).toBe("setItem");
    expect(span.kind).toBe(KIND_CLIENT);
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

  it("records rejected operations as error status + OTEL exception event", async () => {
    const harness = installVercelContext();
    const error = new Error("boom");
    await expect(
      traceKnown(async () => {
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
      traceKnown(async () => {
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

// 2. reportSpan (plugin.ts) — buffering per request, flushing, sampling, guards.
describe("vercel telemetry buffering & reporting", () => {
  it("batches all spans of a request into a single reportSpans call", async () => {
    const harness = installVercelContext();
    await traceKnown();
    await traceKnown();
    await traceKnown();

    // One flush scheduled for the whole request, one IPC message.
    expect(harness.tasks).toHaveLength(1);
    const spans = await flushSpans(harness);
    expect(harness.reports).toHaveLength(1);
    expect(spans).toHaveLength(3);
    expect(new Set(spans.map((span) => span.traceId))).toEqual(new Set([harness.traceId]));
  });

  it("flush is idempotent (buffer cleared after reporting)", async () => {
    const harness = installVercelContext();
    await traceKnown();
    await harness.flush();
    await harness.flush();
    expect(harness.reports).toHaveLength(1);
  });

  it("buffers concurrent requests independently by trace id", async () => {
    const first = installVercelContext();
    await traceKnown();
    const second = installVercelContext();
    await traceKnown();

    const firstSpans = await flushSpans(first);
    const secondSpans = await flushSpans(second);
    expect(firstSpans).toHaveLength(1);
    expect(firstSpans[0].traceId).toBe(first.traceId);
    expect(secondSpans).toHaveLength(1);
    expect(secondSpans[0].traceId).toBe(second.traceId);
  });

  it("does not break traced operations when no request context exists", async () => {
    await expect(traceKnown()).resolves.toBe("ok");
  });

  it("reports nothing without telemetry or rootSpanContext", async () => {
    const noTelemetry = installVercelContext({ telemetry: false });
    await traceKnown();
    expect(noTelemetry.tasks).toHaveLength(0);

    const noRoot = installVercelContext({ rootSpanContext: false });
    await traceKnown();
    expect(noRoot.tasks).toHaveLength(0);
  });

  it("respects the platform sampling decision (traceFlags bit 0)", async () => {
    const unsampled = installVercelContext({ traceFlags: 0 });
    await traceKnown();
    expect(unsampled.tasks).toHaveLength(0);

    const sampled = installVercelContext({ traceFlags: 1 });
    await traceKnown();
    expect(await flushSpans(sampled)).toHaveLength(1);
  });
});

// 3. channel describers (channels.ts) — name/kind/attributes per producer.
describe("vercel telemetry span describers", () => {
  it("describes h3.request route and middleware events", async () => {
    const event = { req: { method: "GET" }, url: { pathname: "/storage" } };
    const spans = await traceSpans(
      ["h3.request", { type: "route", event }],
      ["h3.request", { type: "middleware", event }]
    );
    expect(spans.map((span) => span.name)).toEqual(["GET /storage", "middleware GET /storage"]);
    expect(spans[0].kind).toBe(KIND_INTERNAL);
    expect(attrValue(spans[0], "nitro.channel")).toEqual({ stringValue: "h3.request" });
    expect(attrValue(spans[0], "http.request.method")).toEqual({ stringValue: "GET" });
    expect(attrValue(spans[0], "url.path")).toEqual({ stringValue: "/storage" });
    expect(attrValue(spans[0], "nitro.h3.handler_type")).toEqual({ stringValue: "route" });
    expect(attrValue(spans[1], "nitro.h3.handler_type")).toEqual({ stringValue: "middleware" });
    // No matched route in the payload → no low-cardinality http.route attribute.
    expect(attrValue(spans[0], "http.route")).toBeUndefined();
  });

  it("names h3.request spans by the matched route template", async () => {
    // h3 exposes the matched route on `event.context.matchedRoute` (rou3 syntax).
    const event = {
      req: { method: "GET" },
      url: { pathname: "/users/123" },
      context: { matchedRoute: { route: "/users/:id" } },
    };
    const spans = await traceSpans(
      ["h3.request", { type: "route", event }],
      ["h3.request", { type: "middleware", event }]
    );
    // Span name uses the low-cardinality template, not the concrete path.
    expect(spans.map((span) => span.name)).toEqual(["GET /users/:id", "middleware GET /users/:id"]);
    // The concrete path stays on `url.path`; the template is emitted as `http.route`.
    expect(attrValue(spans[0], "url.path")).toEqual({ stringValue: "/users/123" });
    expect(attrValue(spans[0], "http.route")).toEqual({ stringValue: "/users/:id" });
  });

  it("describes srvx.request with the response status", async () => {
    // `tracePromise` sets `result` on the context when the promise resolves,
    // which is how srvx exposes the response.
    const [span] = await traceSpans([
      "srvx.request",
      { request: { method: "POST", url: "https://example.com/api/hello?x=1" } },
      async () => ({ status: 201 }),
    ]);
    expect(span.name).toBe("POST /api/hello");
    expect(span.kind).toBe(KIND_INTERNAL);
    expect(attrValue(span, "url.path")).toEqual({ stringValue: "/api/hello" });
    expect(attrValue(span, "http.response.status_code")).toEqual({ intValue: 201 });
    // No matched route on the request context → concrete path, no http.route.
    expect(attrValue(span, "http.route")).toBeUndefined();
  });

  it("names srvx.request spans by the matched route template", async () => {
    // The srvx span wraps the whole request, so by the time it closes h3 has
    // populated `matchedRoute` on the shared `request.context`.
    const [span] = await traceSpans([
      "srvx.request",
      {
        request: {
          method: "GET",
          url: "https://example.com/users/123",
          context: { matchedRoute: { route: "/users/:id" } },
        },
      },
      async () => ({ status: 200 }),
    ]);
    expect(span.name).toBe("GET /users/:id");
    expect(attrValue(span, "url.path")).toEqual({ stringValue: "/users/123" });
    expect(attrValue(span, "http.route")).toEqual({ stringValue: "/users/:id" });
    expect(attrValue(span, "http.response.status_code")).toEqual({ intValue: 200 });
  });

  it("describes srvx.middleware with named and anonymous handlers", async () => {
    const request = { method: "GET" };
    const spans = await traceSpans(
      ["srvx.middleware", { request, middleware: { index: 2, handler: { name: "auth" } } }],
      ["srvx.middleware", { request, middleware: { index: 0, handler: { name: "" } } }]
    );
    expect(spans.map((span) => span.name)).toEqual(["middleware auth", "middleware #0"]);
    expect(attrValue(spans[0], "nitro.middleware.index")).toEqual({ intValue: 2 });
    expect(attrValue(spans[0], "nitro.middleware.name")).toEqual({ stringValue: "auth" });
    expect(attrValue(spans[1], "nitro.middleware.name")).toBeUndefined();
  });

  it("describes unstorage.* channels as CLIENT spans", async () => {
    const spans = await traceSpans(
      ["unstorage.getItem", { driver: { name: "redis" }, base: "cache", keys: ["a", "b"] }],
      ["unstorage.setItem", {}]
    );
    expect(spans[0].name).toBe("getItem cache");
    // OTLP wire value CLIENT = 3 (NOT @opentelemetry/api's SpanKind.CLIENT = 2).
    expect(spans[0].kind).toBe(KIND_CLIENT);
    expect(attrValue(spans[0], "db.operation")).toEqual({ stringValue: "getItem" });
    expect(attrValue(spans[0], "db.system")).toEqual({ stringValue: "redis" });
    expect(attrValue(spans[0], "nitro.storage.base")).toEqual({ stringValue: "cache" });
    expect(attrValue(spans[0], "nitro.storage.keys_count")).toEqual({ intValue: 2 });
    expect(spans[1].name).toBe("setItem");
  });

  it("does not trace unknown/undeclared channels", async () => {
    const harness = installVercelContext();
    // Not present in `TRACED_CHANNELS` → never subscribed, so no span is emitted
    // and the traced operation is untouched.
    await expect(traced("ioredis:command", { command: { name: "GET" } })).resolves.toBe("ok");
    await harness.flush();
    expect(harness.tasks).toHaveLength(0);
    expect(harness.reports).toHaveLength(0);
  });

  it("drops the span on malformed payloads without breaking the operation", async () => {
    const harness = installVercelContext();
    // Missing `event` — the h3 describer throws; the span is dropped, not emitted.
    await expect(traced("h3.request", { type: "route" })).resolves.toBe("ok");

    await harness.flush();
    expect(harness.reports).toHaveLength(0);
  });
});

// 4. subscription (plugin.ts) — traced channels are subscribed without patching globals.
describe("vercel telemetry subscription", () => {
  it("does not patch the global tracingChannel", () => {
    expect(diagnostics.tracingChannel).toBe(originalTracingChannel);
  });

  it("traces a declared channel regardless of when the producer creates it", async () => {
    // `subscribe` binds to the channel name; a channel created now still routes
    // to the subscription installed at plugin init.
    const harness = installVercelContext();
    diagnostics.tracingChannel(KNOWN_CHANNEL);
    await traceKnown();
    expect(await flushSpans(harness)).toHaveLength(1);
  });
});
