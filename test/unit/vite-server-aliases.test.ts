import { describe, expect, it, vi } from "vitest";
import { nitroServerAliases } from "../../src/build/vite/_server-aliases.ts";
import type { NitroPluginContext } from "../../src/build/vite/types.ts";

function setup(aliases: Record<string, string>) {
  const ctx = { bundlerConfig: { base: { aliases } } } as unknown as NitroPluginContext;
  const resolveId = nitroServerAliases(ctx).resolveId as (...args: unknown[]) => Promise<unknown>;
  const resolve = vi.fn(async (id: string) => (id === "node:events" ? { id } : null));
  const call = (id: string) => resolveId.call({ resolve }, id, "/app/server.ts", {});
  return { ctx, call, resolve };
}

describe("nitro:server-aliases", () => {
  it("resolves ids aliased to `node:` builtins", async () => {
    const { call, resolve } = setup({
      "events/": "node:events/",
      events: "node:events",
      "~": "/app",
      fs: "~/fs-polyfill",
    });
    expect(await call("events")).toEqual({ id: "node:events" });
    expect(resolve).toHaveBeenCalledWith("node:events", "/app/server.ts", { skipSelf: true });
    expect(await call("events/sub")).toEqual({ id: "node:events/sub", external: true });
    expect(await call("fs")).toBeUndefined();
    expect(await call("eventsource")).toBeUndefined();
  });

  it("normalizes the alias map once per bundler config", async () => {
    let enumerations = 0;
    const aliases = new Proxy({ "~": "/app", events: "node:events" } as Record<string, string>, {
      ownKeys(target) {
        enumerations++;
        return Reflect.ownKeys(target);
      },
    });
    const { ctx, call } = setup(aliases);
    for (let i = 0; i < 20; i++) {
      await call(`./module-${i}.ts`);
    }
    expect(await call("events")).toEqual({ id: "node:events" });
    expect(enumerations).toBe(1);

    ctx.bundlerConfig = { base: { aliases: { events: "node:events/" } } } as any;
    expect(await call("events")).toEqual({ id: "node:events/", external: true });
  });
});
