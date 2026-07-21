import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TracingChannel } from "node:diagnostics_channel";

// ---------------------------------------------------------------------------
// Cloudflare custom-spans simulation (`tracing.enterSpan`)
//
// Mirrors the documented behavior: the callback runs synchronously inside the
// span, and the span ends when the callback returns or its returned promise
// settles. https://developers.cloudflare.com/workers/observability/traces/custom-spans/
// ---------------------------------------------------------------------------

interface FakeSpan {
  name: string;
  attributes: Record<string, string | number | boolean>;
  isTraced: boolean;
  ended: boolean;
  setAttribute(key: string, value?: string | number | boolean): void;
}

const harness = vi.hoisted(() => ({
  spans: [] as FakeSpan[],
  // Sampling decision applied to newly created spans (`head_sampling_rate`).
  isTraced: true,
}));

vi.mock("nitro", () => ({ definePlugin: (def: unknown) => def }));

vi.mock("cloudflare:workers", () => ({
  tracing: {
    enterSpan(name: string, callback: (span: FakeSpan) => unknown) {
      const span: FakeSpan = {
        name,
        attributes: {},
        isTraced: harness.isTraced,
        ended: false,
        setAttribute(key, value) {
          if (this.ended) {
            throw new Error(`setAttribute("${key}") after span ended`);
          }
          if (value !== undefined) {
            this.attributes[key] = value;
          }
        },
      };
      harness.spans.push(span);
      const result = callback(span);
      if (result && typeof (result as Promise<unknown>).then === "function") {
        (result as Promise<unknown>).then(
          () => {
            span.ended = true;
          },
          () => {
            span.ended = true;
          }
        );
      } else {
        span.ended = true;
      }
      return result;
    },
  },
}));

import telemetryPlugin from "../../src/presets/cloudflare/runtime/telemetry/plugin.ts";

const diagnostics = process.getBuiltinModule("node:diagnostics_channel");

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

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

/**
 * Wait for span closure: the deferred the plugin hands to `enterSpan` resolves
 * at `asyncEnd`, and the simulated runtime observes it one microtask later.
 */
function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// Setup: activate the plugin once (it subscribes to the traced channels
// process-wide via `diagnostics_channel.subscribe`; no globals are patched).
// ---------------------------------------------------------------------------

const originalTracingChannel = diagnostics.tracingChannel;

beforeAll(() => {
  (telemetryPlugin as unknown as () => void)();
});

beforeEach(() => {
  harness.spans.length = 0;
  harness.isTraced = true;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("cloudflare telemetry span lifecycle", () => {
  it("opens a span at operation start and closes it at asyncEnd", async () => {
    let midOperation: FakeSpan | undefined;
    await traced("unstorage.setItem", {}, async () => {
      // The span exists (and is still open) while the operation runs.
      midOperation = harness.spans[0];
      expect(midOperation).toBeDefined();
      expect(midOperation!.ended).toBe(false);
      return "ok";
    });
    await settled();

    expect(harness.spans).toHaveLength(1);
    expect(harness.spans[0]).toBe(midOperation);
    expect(harness.spans[0].name).toBe("setItem");
    expect(harness.spans[0].ended).toBe(true);
    expect(harness.spans[0].attributes["db.operation"]).toBe("setItem");
  });

  it("closes overlapping operations independently", async () => {
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = traced("unstorage.getItem", { base: "cache" }, () => firstGate.then(() => "a"));
    const second = traced("unstorage.setItem", {}, async () => "b");

    await second;
    await settled();
    expect(harness.spans).toHaveLength(2);
    const [firstSpan, secondSpan] = harness.spans;
    expect(secondSpan.ended).toBe(true);
    expect(firstSpan.ended).toBe(false);

    releaseFirst();
    await first;
    await settled();
    expect(firstSpan.ended).toBe(true);
    expect(firstSpan.name).toBe("getItem cache");
  });

  it("still closes the span when the operation rejects", async () => {
    const error = new Error("async failure");
    await expect(
      traced("unstorage.setItem", {}, async () => {
        throw error;
      })
    ).rejects.toThrow("async failure");
    await settled();

    const [span] = harness.spans;
    expect(span.ended).toBe(true);
    expect(span.attributes["exception.type"]).toBe("Error");
    expect(span.attributes["exception.message"]).toBe("async failure");
    expect(span.attributes["exception.stacktrace"]).toBe(error.stack);
  });

  it("closes the span when the traced function throws synchronously", async () => {
    // A sync throw makes `tracePromise` publish `end` (with `error` set) and
    // rethrow without ever publishing `asyncEnd`.
    const error = new Error("sync failure");
    expect(() =>
      traced("unstorage.setItem", {}, () => {
        throw error;
      })
    ).toThrow("sync failure");
    await settled();

    const [span] = harness.spans;
    expect(span.ended).toBe(true);
    expect(span.attributes["exception.type"]).toBe("Error");
    expect(span.attributes["exception.message"]).toBe("sync failure");
  });

  it("records the exception even when the describer fails on the completed payload", async () => {
    const error = new Error("late failure");
    const data: Record<string, unknown> = {
      type: "route",
      event: { req: { method: "GET" }, url: { pathname: "/x" } },
    };
    await expect(
      traced("h3.request", data, async () => {
        // The end-time payload no longer matches the describer's shape.
        delete data.event;
        throw error;
      })
    ).rejects.toThrow("late failure");
    await settled();

    const [span] = harness.spans;
    expect(span.ended).toBe(true);
    // The completion falls back to the start-time info: the span keeps its
    // start-time name and attributes, and the error is still recorded.
    expect(span.name).toBe("GET /x");
    expect(span.attributes["http.request.method"]).toBe("GET");
    expect(span.attributes["url.path"]).toBe("/x");
    expect(span.attributes["exception.message"]).toBe("late failure");
  });

  it("records non-Error rejections as exception.message only", async () => {
    await expect(
      traced("unstorage.setItem", {}, async () => {
        throw "plain failure"; // eslint-disable-line no-throw-literal
      })
    ).rejects.toBe("plain failure");
    await settled();

    const [span] = harness.spans;
    expect(span.attributes["exception.message"]).toBe("plain failure");
    expect(span.attributes["exception.type"]).toBeUndefined();
    expect(span.attributes["exception.stacktrace"]).toBeUndefined();
  });

  it("skips attribute work for unsampled requests but still closes the span", async () => {
    harness.isTraced = false;
    await traced("unstorage.setItem", {});
    await settled();

    const [span] = harness.spans;
    expect(span.ended).toBe(true);
    expect(span.attributes).toEqual({});
  });
});

describe("cloudflare telemetry span naming & attributes", () => {
  it("names the span from the start payload and re-describes attributes at end", async () => {
    // The srvx payload has no matched route or response at start — the name is
    // fixed to the concrete path. By `asyncEnd` the producers have populated
    // `context.matchedRoute` and `result`, which land in the attributes.
    const request: Record<string, unknown> = {
      method: "GET",
      url: "https://example.com/users/123",
      context: {} as Record<string, unknown>,
    };
    await traced("srvx.request", { request }, async () => {
      (request.context as Record<string, unknown>).matchedRoute = { route: "/users/:id" };
      return { status: 200 };
    });
    await settled();

    const [span] = harness.spans;
    expect(span.name).toBe("GET /users/123");
    expect(span.attributes["http.request.method"]).toBe("GET");
    expect(span.attributes["url.path"]).toBe("/users/123");
    expect(span.attributes["http.route"]).toBe("/users/:id");
    expect(span.attributes["http.response.status_code"]).toBe(200);
  });

  it("names h3.request spans by the matched route template", async () => {
    const event = {
      req: { method: "GET" },
      url: { pathname: "/users/123" },
      context: { matchedRoute: { route: "/users/:id" } },
    };
    await traced("h3.request", { type: "route", event });
    await settled();

    const [span] = harness.spans;
    expect(span.name).toBe("GET /users/:id");
    expect(span.attributes["h3.handler_type"]).toBe("route");
    expect(span.attributes["http.route"]).toBe("/users/:id");
    expect(span.attributes["url.path"]).toBe("/users/123");
  });

  it("converts every OTLP attribute value variant", async () => {
    await traced("unstorage.getItem", {
      driver: { name: "redis" },
      base: "cache",
      keys: ["a", "b"],
    });
    await settled();

    const [span] = harness.spans;
    expect(span.attributes["db.system"]).toBe("redis"); // stringValue
    expect(span.attributes["unstorage.keys_count"]).toBe(2); // intValue
  });
});

describe("cloudflare telemetry subscription", () => {
  it("does not trace unknown/undeclared channels", async () => {
    await expect(traced("ioredis:command", { command: { name: "GET" } })).resolves.toBe("ok");
    await settled();
    expect(harness.spans).toHaveLength(0);
  });

  it("drops the span on malformed payloads without breaking the operation", async () => {
    // Missing `event` — the h3 describer throws at start; no span is opened.
    await expect(traced("h3.request", { type: "route" })).resolves.toBe("ok");
    await settled();
    expect(harness.spans).toHaveLength(0);
  });

  it("does not patch the global tracingChannel", () => {
    expect(diagnostics.tracingChannel).toBe(originalTracingChannel);
  });

  it("traces a declared channel regardless of when the producer creates it", async () => {
    diagnostics.tracingChannel("unstorage.removeItem");
    await traced("unstorage.removeItem", {});
    await settled();
    expect(harness.spans).toHaveLength(1);
    expect(harness.spans[0].name).toBe("removeItem");
  });
});
