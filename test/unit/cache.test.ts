import { beforeEach, describe, expect, it, vi } from "vitest";

// Capture the options Nitro forwards to ocache.
const { setStorage, captured } = vi.hoisted(() => {
  const captured: { fnOpts?: any; handlerOpts?: any } = {};
  return {
    captured,
    setStorage: vi.fn(),
  };
});

vi.mock("ocache", () => ({
  setStorage,
  defineCachedFunction: (_fn: any, opts: any) => {
    captured.fnOpts = opts;
    return _fn;
  },
  defineCachedHandler: (handler: any, opts: any) => {
    captured.handlerOpts = opts;
    return handler;
  },
}));

vi.mock("../../src/runtime/internal/storage.ts", () => ({
  useStorage: () => ({ getItem: vi.fn(), setItem: vi.fn() }),
}));
vi.mock("../../src/runtime/internal/app.ts", () => ({
  useNitroApp: () => ({ captureError: vi.fn() }),
}));

import { defineCachedFunction, defineCachedHandler } from "../../src/runtime/internal/cache.ts";

beforeEach(() => {
  captured.fnOpts = undefined;
  captured.handlerOpts = undefined;
});

describe("runtime cache", () => {
  it("enables ocache's warnWhenSlower in dev for cached functions", () => {
    defineCachedFunction(() => 0);
    // `import.meta.dev` is defined as true in vitest.config.ts.
    expect(captured.fnOpts.warnWhenSlower).toBe(true);
    expect(captured.fnOpts.group).toBe("nitro/functions");
    expect(typeof captured.fnOpts.onError).toBe("function");
  });

  it("enables ocache's warnWhenSlower in dev for cached handlers", () => {
    defineCachedHandler(() => "ok");
    expect(captured.handlerOpts.warnWhenSlower).toBe(true);
    expect(captured.handlerOpts.group).toBe("nitro/handlers");
  });

  it("lets user options override warnWhenSlower", () => {
    defineCachedFunction(() => 0, { warnWhenSlower: false });
    expect(captured.fnOpts.warnWhenSlower).toBe(false);
  });
});
