import type { NitroPluginContext } from "../../src/build/vite/types.ts";
import { describe, expect, it, vi } from "vitest";

let constructed: ((env: unknown) => void) | undefined;

vi.mock("../../src/build/vite/dev.ts", () => ({
  createFetchableDevEnvironment: () =>
    new Promise((resolve) => {
      constructed = resolve;
    }),
}));

const { createServiceEnvironment } = await import("../../src/build/vite/env.ts");

describe("vite: createServiceEnvironment", () => {
  // The env runner announces every registered environment to the dev worker when it becomes ready. An environment
  // announced before its Vite transport exists loses the worker's first module runner invoke (#4638).
  it("registers a service environment only after it is constructed", async () => {
    const ctx = {
      _envRunner: {},
      nitro: {
        options: {
          dev: true,
          devServer: {},
          exportConditions: [],
          buildDir: "/build",
          rootDir: "/",
        },
      },
    } as unknown as NitroPluginContext;

    const env = createServiceEnvironment(ctx, "ssr", { entry: "/entry-server.ts" });
    const created = env.dev!.createEnvironment!("ssr", {} as any, {} as any);

    await vi.waitFor(() => expect(constructed).toBeDefined());
    expect(ctx._viteEnvs?.has("ssr")).toBeFalsy();

    constructed!({});
    await created;
    expect(ctx._viteEnvs?.get("ssr")).toBe("/entry-server.ts");
  });
});
