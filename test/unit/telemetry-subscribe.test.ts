import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TracingChannel } from "node:diagnostics_channel";
import type { SpanInfo } from "../../src/runtime/internal/telemetry/types.ts";
import { subscribeTracedChannels } from "../../src/runtime/internal/telemetry/subscribe.ts";

const diagnostics = process.getBuiltinModule("node:diagnostics_channel");

interface Completion {
  info: SpanInfo;
  start: string;
  error: unknown;
  state: unknown;
}

// ---------------------------------------------------------------------------
// Setup: `diagnostics_channel.subscribe` has no per-test teardown, so two
// module-level subscriptions (one stateful with `onStart`, one stateless)
// record every completion and delegate the per-test behavior (`onStart`
// return value / sink failures) to swappable implementations.
// ---------------------------------------------------------------------------

const completions: Completion[] = [];
const statelessCompletions: Completion[] = [];
const startInfos: SpanInfo[] = [];
let onStartImpl: ((info: SpanInfo) => unknown) | undefined;
let sinkImpl: ((completion: Completion) => void) | undefined;

beforeAll(() => {
  subscribeTracedChannels(
    (info, start, error, state) => {
      const completion: Completion = { info, start, error, state };
      completions.push(completion);
      sinkImpl?.(completion);
    },
    {
      onStart(info) {
        startInfos.push(info);
        return onStartImpl?.(info);
      },
    }
  );
  subscribeTracedChannels((info, start, error, state) => {
    statelessCompletions.push({ info, start, error, state });
  });
});

beforeEach(() => {
  completions.length = 0;
  statelessCompletions.length = 0;
  startInfos.length = 0;
  onStartImpl = undefined;
  sinkImpl = undefined;
});

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

/** Let any stray `asyncEnd` continuation land before asserting counts. */
function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("subscribeTracedChannels onStart state", () => {
  it("hands the state returned by onStart back to the sink at completion", async () => {
    const token = { platformSpan: true };
    onStartImpl = () => token;

    await traced("unstorage.setItem", { base: "cache" });

    expect(startInfos).toHaveLength(1);
    expect(startInfos[0].name).toBe("setItem cache");
    expect(completions).toHaveLength(1);
    expect(completions[0].state).toBe(token);
    expect(completions[0].info.name).toBe("setItem cache");
    expect(completions[0].error).toBeUndefined();

    // The stateless subscription observes the same operation, without state.
    expect(statelessCompletions).toHaveLength(1);
    expect(statelessCompletions[0].info.name).toBe("setItem cache");
    expect(statelessCompletions[0].state).toBeUndefined();
  });

  it("still delivers the completion when onStart throws", async () => {
    onStartImpl = () => {
      throw new Error("platform refused the span");
    };

    await expect(traced("unstorage.setItem", {})).resolves.toBe("ok");

    expect(completions).toHaveLength(1);
    expect(completions[0].state).toBeUndefined();
    expect(completions[0].info.name).toBe("setItem");
  });

  it("skips onStart on a malformed start payload but still completes", async () => {
    // Missing `event` — the h3 describer throws at start, so `onStart` never
    // runs; by completion the producer has populated the payload.
    const data: Record<string, unknown> = { type: "route" };
    await traced("h3.request", data, async () => {
      data.event = { req: { method: "GET" }, url: { pathname: "/x" } };
      return "ok";
    });

    expect(startInfos).toHaveLength(0);
    expect(completions).toHaveLength(1);
    expect(completions[0].info.name).toBe("GET /x");
    expect(completions[0].state).toBeUndefined();
  });

  it("falls back to the start-time info when the describer fails on the completed payload", async () => {
    const token = { platformSpan: true };
    onStartImpl = () => token;

    const data: Record<string, unknown> = {
      type: "route",
      event: { req: { method: "GET" }, url: { pathname: "/x" } },
    };
    await traced("h3.request", data, async () => {
      // The end-time payload no longer matches the describer's shape.
      delete data.event;
      return "ok";
    });

    expect(startInfos).toHaveLength(1);
    expect(completions).toHaveLength(1);
    // Stateful sinks get the start-time info (name, start attributes) and
    // their state back to release the platform span.
    expect(completions[0].info).toBe(startInfos[0]);
    expect(completions[0].info.name).toBe("GET /x");
    expect(completions[0].state).toBe(token);

    // Without `onStart` there is no start-time info to fall back to, no state
    // to release and nothing to report — the sink is not called at all.
    expect(statelessCompletions).toHaveLength(0);
  });
});

describe("subscribeTracedChannels completion semantics", () => {
  it("reports an operation that throws synchronously exactly once", async () => {
    // A sync throw makes `tracePromise` publish `end` (with `error` set) and
    // rethrow without ever publishing `asyncEnd`.
    const error = new Error("sync failure");
    expect(() =>
      traced("unstorage.setItem", {}, () => {
        throw error;
      })
    ).toThrow("sync failure");
    await settled();

    expect(completions).toHaveLength(1);
    expect(completions[0].error).toBe(error);
    expect(completions[0].info.name).toBe("setItem");
  });

  it("reports a rejected operation exactly once, at asyncEnd", async () => {
    const error = new Error("async failure");
    await expect(
      traced("unstorage.setItem", {}, async () => {
        throw error;
      })
    ).rejects.toThrow("async failure");
    await settled();

    expect(completions).toHaveLength(1);
    expect(completions[0].error).toBe(error);
  });

  it("never breaks the traced operation when the sink throws", async () => {
    sinkImpl = () => {
      throw new Error("sink failure");
    };

    await expect(traced("unstorage.getItem", {})).resolves.toBe("ok");
    expect(completions).toHaveLength(1);
  });
});
