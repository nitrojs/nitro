import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const callHook = vi.fn().mockResolvedValue(undefined);

vi.mock("../../src/runtime/internal/app.ts", () => ({
  useNitroApp: () => ({
    hooks: { callHook },
  }),
}));

import { setupShutdownHooks } from "../../src/runtime/internal/shutdown.ts";

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
    for (const fn of savedSIGTERM) process.on("SIGTERM", fn as NodeJS.SignalsListener);
    for (const fn of savedSIGINT) process.on("SIGINT", fn as NodeJS.SignalsListener);
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
      expect(consoleSpy).toHaveBeenCalledWith("[nitro] Error running close hook:", error);
    });
    consoleSpy.mockRestore();
  });
});
