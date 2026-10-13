import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { TracingChannel } from "node:diagnostics_channel";

vi.mock("nitro", () => ({ definePlugin: (def: unknown) => def }));

import loggerPlugin from "../../src/runtime/internal/telemetry/logger-plugin.ts";

const diagnostics = process.getBuiltinModule("node:diagnostics_channel");

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

/** Minimal stand-in for `nitroApp.hooks` (the `request`/`response` runtime hooks). */
function createHooks() {
  const listeners = new Map<string, Array<(...args: any[]) => unknown>>();
  return {
    hook(name: string, fn: (...args: any[]) => unknown) {
      (listeners.get(name) ?? listeners.set(name, []).get(name)!).push(fn);
    },
    async callHook(name: string, ...args: any[]) {
      for (const fn of listeners.get(name) ?? []) await fn(...args);
    },
  };
}

const hooks = createHooks();

/** Drive a full request lifecycle in a single async context, as nitro/h3 does. */
async function handleRequest(path: string, ops: Array<Parameters<typeof traced>>): Promise<void> {
  const event = { req: { method: "GET", url: `http://localhost${path}` } };
  await hooks.callHook("request", event);
  for (const op of ops) {
    await traced(...op).catch(() => {});
  }
  await hooks.callHook("response", {}, event);
}

// Activate the plugin once; it subscribes to the traced channels process-wide.
beforeAll(() => {
  (loggerPlugin as unknown as (app: unknown) => void)({ hooks });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("telemetry console logger", () => {
  it("does not log for operations outside a request", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await traced("unstorage.getItem", { base: "redis", keys: ["a"] });

    expect(log).not.toHaveBeenCalled();
  });

  it("renders one atomic timeline per request, grouping nested spans", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await handleRequest("/", [
      ["unstorage.getItem", { base: "redis", keys: ["a"] }],
      ["unstorage.setItem", { base: "redis", keys: ["a"] }],
    ]);

    // A single, atomic render for the whole request (not one line per span).
    expect(log).toHaveBeenCalledTimes(1);
    const output = log.mock.calls[0][0] as string;
    expect(output).toMatch(/GET\s+\//); // header: method + path
    expect(output).toContain("2 spans");
    // Successful spans carry the `●` status marker (its failed counterpart is `✖`).
    expect(output).toContain("● getItem redis");
    expect(output).toContain("● setItem redis");
    // Every span line carries a duration bar and a millisecond figure.
    expect(output).toMatch(/█+/);
    expect(output.match(/\d+\.\d{2}ms/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("names the timeline by the request method and path", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await handleRequest("/users/42", [["unstorage.getItem", { base: "redis", keys: [] }]]);

    // The header line carries the request method and path.
    const header = (log.mock.calls[0][0] as string).split("\n").find((l) => l.includes("GET"))!;
    expect(header).toContain("GET");
    expect(header).toContain("/users/42");
  });

  it("marks a failed nested span within the timeline", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await handleRequest("/", [
      [
        "unstorage.setItem",
        { base: "redis", keys: ["a"] },
        async () => {
          throw new Error("boom");
        },
      ],
    ]);

    expect(log).toHaveBeenCalledTimes(1);
    const output = log.mock.calls[0][0] as string;
    expect(output).toContain("✖ setItem redis");
    expect(output).toContain("boom");
  });
});
