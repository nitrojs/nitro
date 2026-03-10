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
import type { ProcessEventMap } from "node:process";

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

  it.each([
    { value: "true", expected: false },
    { value: "false", expected: undefined },
    { value: "", expected: undefined },
    { value: "1", expected: undefined },
    { value: "yes", expected: undefined },
  ])("NITRO_SHUTDOWN_DISABLED=$value returns $expected", ({ value, expected }) => {
    process.env = { ...env, NITRO_SHUTDOWN_DISABLED: value };
    delete process.env.NITRO_SHUTDOWN_TIMEOUT;
    expect(resolveGracefulShutdownConfig()).toBe(expected);
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
  let signals: (keyof ProcessEventMap)[] = ["SIGTERM", "SIGINT"];
  let priors: Record<string, ((...args: any) => void)[]> = Object.fromEntries(
    signals.map((s) => [s, []])
  );

  beforeEach(() => {
    callHook.mockClear();

    for (const signal of signals) {
      priors[signal] = process.listeners(signal).slice();
    }
  });

  afterEach(() => {
    for (const signal of signals) {
      process.removeAllListeners(signal);
      for (const fn of priors[signal]) {
        process.on(signal, fn);
      }
    }
  });

  it.each(["SIGTERM", "SIGINT"])("calls close hook on %s", (signal) => {
    setupShutdownHooks();
    process.emit(signal, true);
    expect(callHook).toHaveBeenCalledOnce();
  });
});
