import type { Server } from "srvx";
import { beforeEach, describe, expect, it, vi } from "vitest";

const callHook = vi.hoisted(() => vi.fn());

vi.mock("../../src/runtime/internal/app.ts", () => ({
  useNitroHooks: () => ({ callHook }),
}));

const { setupCloseHooks } = await import("../../src/runtime/internal/shutdown.ts");

describe("setupCloseHooks", () => {
  beforeEach(() => {
    callHook.mockReset();
    callHook.mockResolvedValue(undefined);
  });

  it("calls `close` hooks after the server is closed", async () => {
    const events: string[] = [];
    callHook.mockImplementationOnce(async () => {
      events.push("hook");
    });
    const server = createServer(async () => {
      events.push("close");
    });

    setupCloseHooks(server);
    await server.close();

    expect(callHook).toHaveBeenCalledWith("close");
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
    expect(callHook).toHaveBeenCalledTimes(1);
  });

  it("calls `close` hooks even if closing the server fails", async () => {
    const server = createServer(() => Promise.reject(new Error("close failed")));

    setupCloseHooks(server);
    await expect(server.close()).rejects.toThrow("close failed");

    expect(callHook).toHaveBeenCalledWith("close");
  });

  it("logs hook errors instead of failing the shutdown", async () => {
    const error = new Error("hook failed");
    callHook.mockRejectedValueOnce(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const server = createServer(() => Promise.resolve());

    setupCloseHooks(server);
    await expect(server.close()).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith(expect.any(String), error);
    consoleError.mockRestore();
  });
});

function createServer(close: (closeActiveConnections?: boolean) => Promise<void>): Server {
  return { close } as Server;
}
