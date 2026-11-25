import type { NitroShutdownContext } from "nitro/types";
import { FastResponse } from "srvx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ close: vi.fn(), shutdown: vi.fn() }));

vi.mock("nitro/app", () => ({
  useNitroHooks: () => ({
    callHook: (name: keyof typeof hooks, ...args: unknown[]) => hooks[name](...args),
  }),
}));

const { shutdownNitro, trackInflight, trackResponse } =
  await import("../../src/presets/neon/runtime/_shutdown.ts");

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

  it("waits for in-flight requests before calling `close` hooks", async () => {
    const events: string[] = [];
    hooks.close.mockImplementationOnce(() => {
      events.push("close");
    });
    trackInflight(sleep(50).then(() => events.push("response")));

    await shutdownNitro({ timeout: 1000 });

    expect(events).toEqual(["response", "close"]);
  });

  it("waits for requests and `waitUntil` work that start during shutdown", async () => {
    const events: string[] = [];
    hooks.shutdown.mockImplementationOnce(() => {
      trackInflight(sleep(50).then(() => events.push("late request")));
    });
    hooks.close.mockImplementationOnce(() => {
      events.push("close");
    });

    await shutdownNitro({ timeout: 1000 });

    expect(events).toEqual(["late request", "close"]);
  });

  it("stops waiting for in-flight requests at the timeout", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let release!: () => void;
    trackInflight(new Promise<void>((resolve) => (release = resolve)));

    const done = shutdownNitro({ timeout: 4000 });
    await vi.advanceTimersByTimeAsync(4000);
    await done;

    expect(hooks.close).toHaveBeenCalledOnce();
    release();
  });

  it("does not fail the shutdown when a request rejects", async () => {
    const rejected = Promise.reject(new Error("request failed"));
    trackInflight(rejected).catch(() => {});

    await shutdownNitro({ timeout: 1000 });

    expect(hooks.close).toHaveBeenCalledOnce();
  });

  it("waits for streamed response bodies to finish", async () => {
    const events: string[] = [];
    hooks.close.mockImplementationOnce(() => {
      events.push("close");
    });
    const response = trackResponse(new Response(slowStream(["a", "b", "c"], 20)));

    const [body] = await Promise.all([
      response.text().then((text) => {
        events.push("body");
        return text;
      }),
      shutdownNitro({ timeout: 1000 }),
    ]);

    expect(body).toBe("abc");
    expect(events).toEqual(["body", "close"]);
  });

  it("stops tracking a response body when the client cancels it", async () => {
    const response = trackResponse(new Response(slowStream(["a", "b"], 1000)));
    await response.body!.cancel();

    await shutdownNitro({ timeout: 1000 });

    expect(hooks.close).toHaveBeenCalledOnce();
  });

  it("stops tracking a response body that fails", async () => {
    const failing = new ReadableStream({
      pull(controller) {
        controller.error(new Error("stream failed"));
      },
    });
    const response = trackResponse(new Response(failing));
    await expect(response.text()).rejects.toThrow("stream failed");

    await shutdownNitro({ timeout: 1000 });

    expect(hooks.close).toHaveBeenCalledOnce();
  });

  it("keeps responses without a body as they are", async () => {
    const response = new Response(null, { status: 204, headers: { "x-test": "1" } });

    expect(trackResponse(response)).toBe(response);
  });

  // The bundle replaces the global `Response` with srvx `FastResponse`.
  it.each([
    ["Response", Response],
    ["FastResponse", FastResponse],
  ])("keeps the status and headers of tracked responses (%s)", async (_name, ResponseClass) => {
    vi.stubGlobal("Response", ResponseClass);
    const response = trackResponse(
      new ResponseClass("ok", { status: 404, statusText: "Not Found", headers: { "x-test": "1" } })
    );
    vi.unstubAllGlobals();

    expect(response.status).toBe(404);
    expect(response.statusText).toBe("Not Found");
    expect(response.headers.get("x-test")).toBe("1");
    expect(await response.text()).toBe("ok");
  });

  it("logs hook errors instead of failing the shutdown", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    hooks.shutdown.mockRejectedValueOnce(new Error("shutdown failed"));

    await shutdownNitro({ timeout: 1000 });

    expect(error).toHaveBeenCalled();
    expect(hooks.close).toHaveBeenCalledOnce();
  });
});

function slowStream(chunks: string[], ms: number) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const chunk = chunks.shift();
      if (chunk === undefined) {
        controller.close();
        return;
      }
      await sleep(ms);
      controller.enqueue(encoder.encode(chunk));
    },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
