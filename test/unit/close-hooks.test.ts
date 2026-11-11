import type { Server } from "srvx";
import type { NitroShutdownContext } from "nitro/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ close: vi.fn(), shutdown: vi.fn() }));

vi.mock("../../src/runtime/internal/app.ts", () => ({
  useNitroHooks: () => ({
    callHook: (name: keyof typeof hooks, ...args: unknown[]) => hooks[name](...args),
  }),
}));

const { setupCloseHooks } = await import("../../src/runtime/internal/shutdown.ts");

describe("setupCloseHooks", () => {
  beforeEach(() => {
    for (const hook of Object.values(hooks)) {
      hook.mockReset();
      hook.mockResolvedValue(undefined);
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("calls `close` hooks after the server is closed", async () => {
    const events: string[] = [];
    hooks.close.mockImplementationOnce(async () => {
      events.push("hook");
    });
    const server = createServer(async () => {
      events.push("close");
    });

    setupCloseHooks(server);
    await server.close();

    expect(hooks.close).toHaveBeenCalled();
    expect(events).toEqual(["close", "hook"]);
  });

  it("calls `close` hooks once but always closes the server", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const server = createServer(close);

    setupCloseHooks(server);
    // srvx forcibly closes again when graceful shutdown times out
    await Promise.all([server.close(), server.close(true)]);

    expect(close).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenLastCalledWith(true);
    expect(hooks.shutdown).toHaveBeenCalledTimes(1);
    expect(hooks.close).toHaveBeenCalledTimes(1);
  });

  it("calls `close` hooks even if closing the server fails", async () => {
    const server = createServer(() => Promise.reject(new Error("close failed")));

    setupCloseHooks(server);
    await expect(server.close()).rejects.toThrow("close failed");

    expect(hooks.close).toHaveBeenCalled();
  });

  it("logs hook errors instead of failing the shutdown", async () => {
    const error = new Error("hook failed");
    hooks.close.mockRejectedValueOnce(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const server = createServer(() => Promise.resolve());

    setupCloseHooks(server);
    await expect(server.close()).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith(expect.any(String), error);
  });

  it("calls `shutdown` hooks first and `close` hooks after their work", async () => {
    const events: string[] = [];
    let finish!: () => void;
    hooks.shutdown.mockImplementationOnce((ctx: NitroShutdownContext) => {
      events.push("shutdown");
      ctx.waitUntil(new Promise<void>((resolve) => (finish = resolve)));
    });
    hooks.close.mockImplementationOnce(() => {
      events.push("hook");
    });
    const server = createServer(async () => {
      events.push("close");
    });

    setupCloseHooks(server);
    const closed = Promise.all([server.close(), server.close(true)]);
    await sleep();
    expect(events).toEqual(["close", "shutdown", "close"]);

    finish();
    await closed;
    expect(events).toEqual(["close", "shutdown", "close", "hook"]);
  });

  it("awaits `shutdown` work registered until the server is closed", async () => {
    const events: string[] = [];
    let waitUntil!: NitroShutdownContext["waitUntil"];
    hooks.shutdown.mockImplementationOnce((ctx: NitroShutdownContext) => {
      waitUntil = ctx.waitUntil;
    });
    hooks.close.mockImplementationOnce(() => {
      events.push("hook");
    });
    let finishClose!: () => void;
    const server = createServer(() => new Promise<void>((resolve) => (finishClose = resolve)));

    setupCloseHooks(server);
    const closed = server.close();
    await sleep();

    // A request still being drained starts more work
    let finishWork!: () => void;
    waitUntil(
      new Promise<void>((resolve) => (finishWork = resolve)).then(() => events.push("work"))
    );
    finishClose();
    await sleep();
    expect(events).toEqual([]);

    finishWork();
    await closed;
    await vi.waitFor(() => expect(events).toEqual(["work", "hook"]));
  });

  it("logs `shutdown` hook errors instead of failing the shutdown", async () => {
    const error = new Error("shutdown failed");
    hooks.shutdown.mockImplementationOnce((ctx: NitroShutdownContext) => {
      ctx.waitUntil(Promise.reject(error));
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const server = createServer(() => Promise.resolve());

    setupCloseHooks(server);
    await expect(server.close()).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith(expect.any(String), error);
    expect(hooks.close).toHaveBeenCalled();
  });

  it.each([
    { name: "default", env: undefined, config: undefined, timeout: 5000 },
    { name: "SERVER_SHUTDOWN_TIMEOUT", env: "2", config: undefined, timeout: 2000 },
    { name: "gracefulTimeout", env: "2", config: { gracefulTimeout: 3 }, timeout: 3000 },
  ])("aborts `shutdown` work after the timeout ($name)", async ({ env, config, timeout }) => {
    if (env) {
      vi.stubEnv("SERVER_SHUTDOWN_TIMEOUT", env);
    }
    let signal!: AbortSignal;
    hooks.shutdown.mockImplementationOnce((ctx: NitroShutdownContext) => {
      signal = ctx.signal;
      ctx.waitUntil(new Promise(() => {}));
    });
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const server = createServer(() => Promise.resolve(), config);
    vi.useFakeTimers();

    setupCloseHooks(server);
    const closed = server.close();
    await vi.advanceTimersByTimeAsync(timeout - 1);
    expect(signal.aborted).toBe(false);
    expect(hooks.close).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(signal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    await closed;
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining(`${timeout}ms`));
    expect(hooks.close).toHaveBeenCalled();
  });
});

function createServer(
  close: (closeActiveConnections?: boolean) => Promise<void>,
  gracefulShutdown?: { gracefulTimeout?: number }
): Server {
  return { close, options: { gracefulShutdown } } as Server;
}

function sleep(ms = 10) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
