import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { storage } = vi.hoisted(() => {
  const data = new Map<string, unknown>();
  const writes: Array<() => void> = [];
  return {
    storage: {
      data,
      writes,
      // Writes only land when `landWrites()` is called
      hold: false,
      getItem: async (key: string) => data.get(key) ?? null,
      setItem(key: string, value: unknown) {
        const write = () => void data.set(key, structuredClone(value));
        if (!this.hold) {
          write();
          return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
          writes.push(() => {
            write();
            resolve();
          });
        });
      },
      removeItem: async (key: string) => void data.delete(key),
      landWrites() {
        for (const land of writes.splice(0)) land();
      },
    },
  };
});

vi.mock("../../src/runtime/internal/storage", () => ({
  useStorage: () => storage,
}));

vi.mock("../../src/runtime/internal/app", () => ({
  useNitroApp: () => ({ captureError: () => {} }),
}));

const { defineCachedFunction } =
  await import("../../src/runtime/internal/cache");

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("cache: pending resolution while storage write is in flight", () => {
  beforeEach(() => {
    storage.data.clear();
    storage.writes.length = 0;
    storage.hold = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not re-run the function before the write lands (#4660)", async () => {
    let calls = 0;
    const fn = defineCachedFunction(() => ++calls, {
      name: "slowWrite",
      maxAge: 60,
    });

    expect(await fn()).toBe(1);
    expect(await fn()).toBe(1);
    expect(await fn()).toBe(1);
    expect(calls).toBe(1);

    storage.landWrites();
    await flush();
    expect(await fn()).toBe(1);
    expect(calls).toBe(1);
  });

  it("releases the key once the write lands", async () => {
    let calls = 0;
    const fn = defineCachedFunction(() => ++calls, {
      name: "released",
      maxAge: 60,
    });

    expect(await fn()).toBe(1);
    storage.landWrites();
    await flush();

    // Entry removed out of band: next call must resolve again
    storage.data.clear();
    expect(await fn()).toBe(2);
    expect(calls).toBe(2);
  });

  it("does not pin the key when the write never settles", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let calls = 0;
    const fn = defineCachedFunction(() => ++calls, {
      name: "hungWrite",
      maxAge: 60,
    });

    expect(await fn()).toBe(1);
    expect(await fn()).toBe(1);

    vi.setSystemTime(Date.now() + 40_000);
    expect(await fn()).toBe(2);
    expect(calls).toBe(2);
  });

  it("caps the hold at maxAge", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let calls = 0;
    const fn = defineCachedFunction(() => ++calls, {
      name: "shortMaxAge",
      maxAge: 1,
    });

    expect(await fn()).toBe(1);
    vi.setSystemTime(Date.now() + 1500);
    expect(await fn()).toBe(2);
  });

  it("releases the key right away when nothing is written", async () => {
    let calls = 0;
    const fn = defineCachedFunction(() => ++calls, {
      name: "invalid",
      maxAge: 60,
      validate: () => false,
    });

    expect(await fn()).toBe(1);
    expect(await fn()).toBe(2);
    expect(storage.writes.length).toBe(0);
  });

  it("an old write settling does not release a newer resolution", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let calls = 0;
    let unblock!: () => void;
    const fn = defineCachedFunction(
      async () => {
        const n = ++calls;
        if (n === 2) {
          await new Promise<void>((r) => (unblock = r));
        }
        return n;
      },
      { name: "newer", maxAge: 60 }
    );

    expect(await fn()).toBe(1);
    // Hold expired: a new resolution starts and stays in flight
    vi.setSystemTime(Date.now() + 40_000);
    const second = fn();
    await flush();
    expect(calls).toBe(2);

    // First write lands while the second resolution is still in flight
    storage.landWrites();
    await flush();
    storage.data.clear();

    // Still follows the in-flight resolution instead of starting a third
    const third = fn();
    await flush();
    expect(calls).toBe(2);
    unblock();
    expect(await second).toBe(2);
    expect(await third).toBe(2);
  });

  it("releases the key when validate throws", async () => {
    let calls = 0;
    const fn = defineCachedFunction(() => ++calls, {
      name: "validateThrows",
      maxAge: 60,
      validate: (entry) => {
        if (entry.value === undefined) {
          return false;
        }
        if (entry.value === 1) {
          throw new Error("invalid value");
        }
        return true;
      },
    });

    await expect(fn()).rejects.toThrow("invalid value");
    expect(await fn()).toBe(2);
    expect(calls).toBe(2);
  });

  it("a forced call does not follow a held resolution", async () => {
    let calls = 0;
    let force = false;
    const fn = defineCachedFunction(() => ++calls, {
      name: "forced",
      maxAge: 60,
      shouldInvalidateCache: () => force,
    });

    expect(await fn()).toBe(1);
    force = true;
    expect(await fn()).toBe(2);
    expect(calls).toBe(2);
  });

  it("a shared promise from the function does not mix up resolutions", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let calls = 0;
    const shared = Promise.resolve("shared");
    const fn = defineCachedFunction(
      () => {
        calls++;
        return shared;
      },
      { name: "sharedPromise", maxAge: 60 }
    );

    expect(await fn()).toBe("shared");
    // First hold expires: a second resolution starts with its own held write
    vi.setSystemTime(Date.now() + 40_000);
    expect(await fn()).toBe("shared");
    expect(calls).toBe(2);

    // Only the first write lands: it must not release the second resolution
    storage.writes.shift()!();
    await flush();
    storage.data.clear();
    expect(await fn()).toBe("shared");
    expect(calls).toBe(2);
  });
});
