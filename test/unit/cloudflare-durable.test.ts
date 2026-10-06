import { describe, expect, it, vi } from "vitest";
import { createDurableStubResolver } from "../../src/presets/cloudflare/runtime/_durable.ts";

describe("cloudflare durable resolution", () => {
  const request = new Request("https://nitro.build/chat");

  it.each([
    { instanceName: "app-server", expected: "app-server" },
    { instanceName: "", expected: "server" },
    { instanceName: "fallback", resolveInstanceName: () => "chat-room", expected: "chat-room" },
    { instanceName: "fallback", resolveInstanceName: async () => undefined, expected: "fallback" },
    { instanceName: "fallback", resolveInstanceName: async () => "", expected: "fallback" },
  ])("resolves the instance to $expected", async ({ expected, ...options }) => {
    const binding = { idFromName: vi.fn(() => "id"), get: vi.fn(() => "stub") };
    const resolve = createDurableStubResolver({ bindingName: "CustomDO", ...options });
    await expect(resolve(undefined, { CustomDO: binding })).resolves.toBe("stub");
    expect(binding.idFromName).toHaveBeenCalledWith(expected);
    expect(binding.get).toHaveBeenCalledWith("id");
  });

  it("passes the request and environment to an async resolver", async () => {
    const env = { tenant: "one", CustomDO: { idFromName: vi.fn(), get: vi.fn() } };
    const resolveInstanceName = vi.fn(async () => "tenant-one");
    const resolve = createDurableStubResolver({
      bindingName: "CustomDO",
      instanceName: "fallback",
      resolveInstanceName,
    });
    await resolve(request, env);
    expect(resolveInstanceName).toHaveBeenCalledWith({
      request,
      env,
      context: undefined,
      defaultInstanceName: "fallback",
    });
    expect(env.CustomDO.idFromName).toHaveBeenCalledWith("tenant-one");
  });

  it("reports a missing binding before calling the resolver", async () => {
    const resolveInstanceName = vi.fn();
    const resolve = createDurableStubResolver({
      bindingName: "MissingDO",
      instanceName: "server",
      resolveInstanceName,
    });
    await expect(resolve(request, {})).rejects.toThrow('binding "MissingDO" not available');
    expect(resolveInstanceName).not.toHaveBeenCalled();
  });

  it("propagates resolver rejection without opening the fallback instance", async () => {
    const idFromName = vi.fn();
    const resolve = createDurableStubResolver({
      bindingName: "CustomDO",
      instanceName: "server",
      resolveInstanceName: async () => {
        throw new Error("tenant lookup failed");
      },
    });
    await expect(resolve(request, { CustomDO: { idFromName } })).rejects.toThrow(
      "tenant lookup failed"
    );
    expect(idFromName).not.toHaveBeenCalled();
  });
});
