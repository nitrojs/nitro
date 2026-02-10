import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const callHook = vi.fn().mockResolvedValue(undefined);

vi.mock("../../src/runtime/internal/app.ts", () => ({
  useNitroApp: () => ({
    hooks: { callHook },
  }),
}));

import {
  resolveGracefulShutdownConfig,
  setupShutdownHooks,
} from "../../src/runtime/internal/shutdown.ts";

describe("resolveGracefulShutdownConfig", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("returns undefined by default", () => {
    process.env = { ...env };
    delete process.env.NITRO_SHUTDOWN_DISABLED;
    delete process.env.NITRO_SHUTDOWN_TIMEOUT;
    expect(resolveGracefulShutdownConfig()).toBeUndefined();
  });

  it("returns false when NITRO_SHUTDOWN_DISABLED is 'true'", () => {
    process.env = { ...env, NITRO_SHUTDOWN_DISABLED: "true" };
    expect(resolveGracefulShutdownConfig()).toBe(false);
  });

  it("returns gracefulTimeout in seconds from NITRO_SHUTDOWN_TIMEOUT ms", () => {
    process.env = { ...env, NITRO_SHUTDOWN_TIMEOUT: "10000" };
    delete process.env.NITRO_SHUTDOWN_DISABLED;
    expect(resolveGracefulShutdownConfig()).toEqual({ gracefulTimeout: 10 });
  });

  it("disabled takes priority over timeout", () => {
    process.env = {
      ...env,
      NITRO_SHUTDOWN_DISABLED: "true",
      NITRO_SHUTDOWN_TIMEOUT: "10000",
    };
    expect(resolveGracefulShutdownConfig()).toBe(false);
  });

  it("ignores non-numeric timeout", () => {
    process.env = { ...env, NITRO_SHUTDOWN_TIMEOUT: "abc" };
    delete process.env.NITRO_SHUTDOWN_DISABLED;
    expect(resolveGracefulShutdownConfig()).toBeUndefined();
  });
});

describe("setupShutdownHooks", () => {
  let savedSIGTERM: Function[];
  let savedSIGINT: Function[];

  beforeEach(() => {
    savedSIGTERM = process.listeners("SIGTERM").slice();
    savedSIGINT = process.listeners("SIGINT").slice();
    callHook.mockClear();
    callHook.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.removeAllListeners("SIGTERM");
    process.removeAllListeners("SIGINT");
    for (const fn of savedSIGTERM)
      process.on("SIGTERM", fn as NodeJS.SignalsListener);
    for (const fn of savedSIGINT)
      process.on("SIGINT", fn as NodeJS.SignalsListener);
  });

  it("registers SIGTERM and SIGINT handlers", () => {
    const beforeTERM = process.listenerCount("SIGTERM");
    const beforeINT = process.listenerCount("SIGINT");
    setupShutdownHooks();
    expect(process.listenerCount("SIGTERM")).toBe(beforeTERM + 1);
    expect(process.listenerCount("SIGINT")).toBe(beforeINT + 1);
  });

  it("calls close hook on SIGTERM", async () => {
    setupShutdownHooks();
    process.emit("SIGTERM", "SIGTERM");
    await vi.waitFor(() => {
      expect(callHook).toHaveBeenCalledWith("close");
    });
  });

  it("calls close hook on SIGINT", async () => {
    setupShutdownHooks();
    process.emit("SIGINT", "SIGINT");
    await vi.waitFor(() => {
      expect(callHook).toHaveBeenCalledWith("close");
    });
  });

  it("logs error if close hook throws", async () => {
    const error = new Error("cleanup failed");
    callHook.mockRejectedValueOnce(error);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setupShutdownHooks();
    process.emit("SIGTERM", "SIGTERM");
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "[nitro] Error running close hook:",
        error
      );
    });
    consoleSpy.mockRestore();
  });
});
