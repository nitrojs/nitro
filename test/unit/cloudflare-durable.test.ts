import { describe, expect, it, vi } from "vitest";
import {
  getDurableStub,
  resolveDurableInstanceName,
} from "../../src/presets/cloudflare/runtime/_durable.ts";

describe("cloudflare durable helpers", () => {
  it("falls back to the configured default instance name", async () => {
    await expect(
      resolveDurableInstanceName({
        env: {},
        defaultInstanceName: "app-server",
      })
    ).resolves.toBe("app-server");
    await expect(
      resolveDurableInstanceName({
        env: {},
        defaultInstanceName: "",
      })
    ).resolves.toBe("server");
  });

  it("uses the resolver result when available", async () => {
    await expect(
      resolveDurableInstanceName({
        request: new Request("https://nitro.build/chat"),
        env: { foo: "bar" },
        defaultInstanceName: "app-server",
        resolveInstanceName: ({ request }) =>
          request?.url.includes("/chat") ? "chat-room" : undefined,
      })
    ).resolves.toBe("chat-room");
  });

  it("resolves a durable stub with requestless fallback", async () => {
    const get = vi.fn();
    const idFromName = vi.fn(() => "durable-id");

    await getDurableStub({
      bindingName: "$DurableObject",
      instanceName: "app-server",
      env: {
        $DurableObject: {
          idFromName,
          get,
        },
      },
    });

    expect(idFromName).toHaveBeenCalledWith("app-server");
    expect(get).toHaveBeenCalledWith("durable-id");
  });
});
