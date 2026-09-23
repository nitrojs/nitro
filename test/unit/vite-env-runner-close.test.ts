import type { NitroPluginContext } from "../../src/build/vite/types.ts";
import { describe, expect, it } from "vitest";
import { closeEnvRunner, initEnvRunner } from "../../src/build/vite/env.ts";

describe("vite: closeEnvRunner", () => {
  it("does not throw when the runner failed to start", async () => {
    const initPromise = Promise.reject(new Error("failed to start"));
    initPromise.catch(() => {});
    const ctx = { _initPromise: initPromise } as unknown as NitroPluginContext;
    await expect(closeEnvRunner(ctx)).resolves.toBeUndefined();
  });

  it("does not start a runner after close", async () => {
    const ctx = {} as NitroPluginContext;
    await closeEnvRunner(ctx);
    await expect(initEnvRunner(ctx)).rejects.toThrow(/closed/);
    expect(ctx._initPromise).toBeUndefined();
  });
});
