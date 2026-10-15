import { describe, expect, it } from "vitest";
import type { NitroOptions } from "nitro/types";
import { resolveServerTimingOptions } from "../../src/config/resolvers/server-timing.ts";

async function resolve(
  serverTiming: unknown,
  opts: { preset?: string; database?: boolean; dev?: boolean } = {}
): Promise<NitroOptions["serverTiming"]> {
  const options = {
    serverTiming,
    dev: opts.dev ?? false,
    preset: opts.preset ?? "node-server",
    experimental: { database: opts.database ?? true },
  } as unknown as NitroOptions;
  await resolveServerTimingOptions(options);
  return options.serverTiming;
}

const all = { total: true, kv: true, db: true, cache: true };

describe("config: serverTiming", () => {
  it("is enabled by default in development only", async () => {
    expect(await resolve(undefined, { dev: true })).toEqual(all);
    expect(await resolve(undefined)).toBe(false);
  });

  it("can be enabled in production", async () => {
    expect(await resolve(true)).toEqual(all);
    expect(await resolve({ kv: false })).toEqual({ ...all, kv: false });
  });

  it("can be disabled in development", async () => {
    expect(await resolve(false, { dev: true })).toBe(false);
  });

  it("can be disabled", async () => {
    expect(await resolve(false)).toBe(false);
  });

  it("merges per-metric options over the defaults", async () => {
    expect(await resolve({ kv: false })).toEqual({ ...all, kv: false });
  });

  it("is disabled when every metric is disabled", async () => {
    expect(await resolve({ total: false, kv: false, db: false, cache: false })).toBe(false);
  });

  it("disables db without experimental.database", async () => {
    expect(await resolve(true, { database: false })).toEqual({ ...all, db: false });
  });

  it("is disabled for prerendering", async () => {
    expect(await resolve(true, { preset: "nitro-prerender" })).toBe(false);
  });
});
