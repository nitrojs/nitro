import { describe, expect, it, vi } from "vitest";
import type { NitroOptions } from "nitro/types";
import { resolveKVOptions } from "../../src/config/resolvers/kv.ts";
import { resolveStorageMounts } from "../../src/utils/storage.ts";

const warn = vi.hoisted(() => vi.fn());
vi.mock("consola", () => ({ default: { warn } }));

function createOptions(options: Partial<NitroOptions>): NitroOptions {
  return { rootDir: process.cwd(), kv: {}, devStorage: {}, ...options } as NitroOptions;
}

describe("resolveKVOptions", () => {
  it("merges deprecated `storage` into `kv`", async () => {
    warn.mockClear();
    const options = createOptions({
      kv: { data: { driver: "memory" } },
      storage: { legacy: { driver: "memory" }, data: { driver: "fs" } },
    });
    await resolveKVOptions(options);
    expect(options.kv).toEqual({ legacy: { driver: "memory" }, data: { driver: "memory" } });
    expect(options.storage).toBe(options.kv);
    expect(warn).toHaveBeenCalledOnce();
  });

  it.each<Partial<NitroOptions>>([{ dev: true }, { preset: "nitro-prerender" }])(
    "still applies deprecated `devStorage` (%o)",
    async (env) => {
      warn.mockClear();
      const options = createOptions({
        ...env,
        kv: { data: { driver: "redis", host: "prod.example.com" } },
        devStorage: { data: { driver: "memory" } },
      });
      await resolveKVOptions(options);
      expect(warn).toHaveBeenCalledOnce();
      expect(resolveStorageMounts(options)).toMatchObject([{ name: "memory", options: {} }]);
    }
  );

  it("does not warn when only `kv` is used", async () => {
    warn.mockClear();
    const options = createOptions({ kv: { data: { driver: "memory" } } });
    await resolveKVOptions(options);
    expect(options.storage).toBe(options.kv);
    expect(warn).not.toHaveBeenCalled();
  });
});
