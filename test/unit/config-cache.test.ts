import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "pathe";
import { describe, expect, it, vi } from "vitest";
import type { Nitro, NitroOptions } from "nitro/types";
import { resolveCacheOptions } from "../../src/config/resolvers/cache.ts";
import cache from "../../src/build/virtual/cache.ts";
import { createFSCacheStorage } from "../../src/runtime/internal/cache-fs.ts";
import { defineCachedFunction } from "ocache";

const warn = vi.hoisted(() => vi.fn());
vi.mock("consola", () => ({ default: { warn } }));

function createOptions(options: Partial<NitroOptions>): NitroOptions {
  return {
    rootDir: "/app",
    node: true,
    kv: {},
    devStorage: {},
    cache: {},
    ...options,
  } as NitroOptions;
}

describe("resolveCacheOptions", () => {
  it("defaults to the memory driver", async () => {
    const options = createOptions({ kv: { data: { driver: "fs" } } });
    await resolveCacheOptions(options);
    expect(options.cache.driver).toBe("memory");
  });

  it.each(["cache", "/cache", "cache:nitro", "/cache/nitro", "cache/functions"])(
    "defaults to the kv driver with a `%s` kv mount",
    async (mount) => {
      const options = createOptions({ kv: { [mount]: { driver: "redis" } } });
      await resolveCacheOptions(options);
      expect(options.cache.driver).toBe("kv");
    }
  );

  it("does not treat `cached` mount as a cache mount", async () => {
    const options = createOptions({ kv: { cached: { driver: "redis" } } });
    await resolveCacheOptions(options);
    expect(options.cache.driver).toBe("memory");
  });

  it("detects deprecated `devStorage` cache mounts in development", async () => {
    const options = createOptions({ dev: true, devStorage: { cache: { driver: "fs" } } });
    await resolveCacheOptions(options);
    expect(options.cache.driver).toBe("kv");
  });

  it("keeps an explicit driver with a cache kv mount", async () => {
    const options = createOptions({
      kv: { cache: { driver: "redis" } },
      cache: { driver: "memory" },
    });
    await resolveCacheOptions(options);
    expect(options.cache.driver).toBe("memory");
  });

  it("throws on an invalid driver", async () => {
    const options = createOptions({ cache: { driver: "redis" as any } });
    await expect(resolveCacheOptions(options)).rejects.toThrow("Invalid `cache.driver`");
  });

  it("throws on a non-object config", async () => {
    const options = createOptions({ cache: false as any });
    await expect(resolveCacheOptions(options)).rejects.toThrow("Invalid `cache` config");
  });

  it("resolves the fs dir against rootDir in development only", async () => {
    const dev = createOptions({ dev: true, cache: { driver: "fs" } });
    await resolveCacheOptions(dev);
    expect(dev.cache.fs?.dir).toBe("/app/.data/cache");

    const prod = createOptions({ cache: { driver: "fs", fs: { dir: "./tmp/cache" } } });
    await resolveCacheOptions(prod);
    expect(prod.cache.fs?.dir).toBe("./tmp/cache");
  });

  it("warns when using the fs driver on non-node presets", async () => {
    warn.mockClear();
    const options = createOptions({ node: false, cache: { driver: "fs" } });
    await resolveCacheOptions(options);
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("virtual/cache template", () => {
  const render = (config: NitroOptions["cache"]) =>
    cache({ options: { cache: config } } as unknown as Nitro).template();

  it("uses ocache memory storage", () => {
    const template = render({ driver: "memory", memory: { maxSize: Infinity } });
    expect(template).toContain(`import { createMemoryStorage } from "ocache"`);
    expect(template).toContain(`createMemoryStorage({"maxSize":Infinity})`);
    expect(template).not.toContain("cache-kv");
  });

  it("uses kv storage", () => {
    const template = render({ driver: "kv" });
    expect(template).toContain(`from "#nitro/runtime/cache-kv"`);
    expect(template).not.toContain("createMemoryStorage");
  });

  it("uses fs storage", () => {
    const template = render({ driver: "fs", fs: { dir: "/app/.data/cache" } });
    expect(template).toContain(`createFSCacheStorage({"dir":"/app/.data/cache"})`);
  });

  it("splits global defaults for functions and handlers", () => {
    const template = render({
      driver: "memory",
      defaults: { maxAge: 60, swr: true, varies: ["accept-language"] },
    });
    expect(template).toContain(`cacheFunctionDefaults = {"maxAge":60,"swr":true}`);
    expect(template).toContain(
      `cacheHandlerDefaults = {"maxAge":60,"swr":true,"varies":["accept-language"]}`
    );
  });
});

describe("fs cache storage", () => {
  it("persists entries across storage instances", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nitro-cache-fs-"));
    try {
      let calls = 0;
      const create = () =>
        defineCachedFunction(async (n: number) => ({ n, calls: ++calls }), {
          name: "test",
          maxAge: 60,
          storage: createFSCacheStorage({ dir }),
        });
      const entries = () => readdirSync(resolve(dir, "cache/functions/test"));
      expect(await create()(1)).toEqual({ n: 1, calls: 1 });
      await vi.waitFor(() => expect(entries()).toHaveLength(1));
      expect(await create()(1)).toEqual({ n: 1, calls: 1 });
      expect(await create()(2)).toEqual({ n: 2, calls: 2 });
      await vi.waitFor(() => expect(entries()).toHaveLength(2));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects path traversal keys", async () => {
    const storage = createFSCacheStorage({ dir: "/tmp/nitro-cache" });
    await expect(storage.get("cache:..:..:etc:passwd")).rejects.toThrow("Invalid cache key");
  });
});
