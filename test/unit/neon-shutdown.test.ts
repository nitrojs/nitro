import type { NitroShutdownContext } from "nitro/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ close: vi.fn(), shutdown: vi.fn() }));

vi.mock("nitro/app", () => ({
  useNitroHooks: () => ({
    callHook: (name: keyof typeof hooks, ...args: unknown[]) => hooks[name](...args),
  }),
}));

const { shutdownNitro } = await import("../../src/presets/neon/runtime/_shutdown.ts");

describe("neon shutdownNitro", () => {
  beforeEach(() => {
    for (const hook of Object.values(hooks)) {
      hook.mockReset();
      hook.mockResolvedValue(undefined);
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("waits for `shutdown` work before calling `close` hooks", async () => {
    const events: string[] = [];
    hooks.shutdown.mockImplementationOnce((ctx: NitroShutdownContext) => {
      ctx.waitUntil(sleep(50).then(() => events.push("flushed")));
    });
    hooks.close.mockImplementationOnce(() => {
      events.push("close");
    });

    await shutdownNitro({ timeout: 1000 });

    expect(events).toEqual(["flushed", "close"]);
  });

  it("stops waiting at the timeout and aborts the signal", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let signal!: AbortSignal;
    hooks.shutdown.mockImplementationOnce((ctx: NitroShutdownContext) => {
      signal = ctx.signal;
      ctx.waitUntil(new Promise(() => {}));
    });

    const done = shutdownNitro({ timeout: 4000 });
    await vi.advanceTimersByTimeAsync(4000);
    await done;

    expect(signal.aborted).toBe(true);
    expect(hooks.close).toHaveBeenCalledOnce();
  });

  it("logs hook errors instead of failing the shutdown", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    hooks.shutdown.mockRejectedValueOnce(new Error("shutdown failed"));

    await shutdownNitro({ timeout: 1000 });

    expect(error).toHaveBeenCalled();
    expect(hooks.close).toHaveBeenCalledOnce();
  });
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
