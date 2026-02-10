import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const callHook = vi.fn();

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

  it("calls close hook on SIGTERM", () => {
    setupShutdownHooks();
    process.emit("SIGTERM", "SIGTERM");
    expect(callHook).toHaveBeenCalledWith("close");
  });

  it("calls close hook on SIGINT", () => {
    setupShutdownHooks();
    process.emit("SIGINT", "SIGINT");
    expect(callHook).toHaveBeenCalledWith("close");
  });
});
