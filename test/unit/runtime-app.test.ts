import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { callHookMock } = vi.hoisted(() => ({
  callHookMock: vi.fn(() => Promise.resolve()),
}));

vi.mock("#nitro/virtual/app", () => ({
  createNitroApp: () => ({
    hooks: { callHook: callHookMock },
  }),
  initNitroPlugins: vi.fn(),
}));
vi.mock("#nitro/virtual/routing", () => ({
  findRouteRules: vi.fn(() => []),
}));

import { nitroRuntimeHooksPlugin } from "../../src/runtime/internal/app.ts";

describe("nitroRuntimeHooksPlugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the Nitro close hook before closing an srvx server", async () => {
    const closeMock = vi.fn((_closeActiveConnections?: boolean) => Promise.resolve());
    const server = { close: closeMock };
    nitroRuntimeHooksPlugin(server as unknown as Parameters<typeof nitroRuntimeHooksPlugin>[0]);

    await server.close();
    await server.close(true);

    expect(callHookMock).toHaveBeenCalledOnce();
    expect(callHookMock).toHaveBeenCalledWith("close");
    expect(closeMock).toHaveBeenNthCalledWith(1);
    expect(closeMock).toHaveBeenNthCalledWith(2, true);
    expect(callHookMock.mock.invocationCallOrder[0]).toBeLessThan(
      closeMock.mock.invocationCallOrder[0]!
    );
  });

  it("closes the srvx server when a Nitro close hook fails", async () => {
    const error = new Error("close hook failed");
    callHookMock.mockRejectedValueOnce(error);
    const consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => {});
    const closeMock = vi.fn(() => Promise.resolve());
    const server = { close: closeMock };
    nitroRuntimeHooksPlugin(server as unknown as Parameters<typeof nitroRuntimeHooksPlugin>[0]);

    await expect(server.close()).resolves.toBeUndefined();

    expect(closeMock).toHaveBeenCalledOnce();
    expect(consoleErrorMock).toHaveBeenCalledWith("Error while running Nitro close hooks", error);
  });
});
