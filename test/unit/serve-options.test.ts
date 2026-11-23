import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("#nitro/virtual/server-entry", () => ({ serverEntryOptions: {} }));
vi.mock("#nitro/virtual/tracing", () => ({ tracingSrvxPlugins: [] }));

import { resolveServeOptions } from "../../src/runtime/internal/serve.ts";

const fetch = () => new Response();

describe("resolveServeOptions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers NITRO_PORT over PORT", () => {
    vi.stubEnv("NITRO_PORT", "4001");
    vi.stubEnv("PORT", "4002");
    expect(resolveServeOptions({ fetch }).port).toBe(4001);
  });

  it("falls back to PORT when NITRO_PORT is empty", () => {
    vi.stubEnv("NITRO_PORT", "");
    vi.stubEnv("PORT", "4002");
    expect(resolveServeOptions({ fetch }).port).toBe(4002);
  });

  it("keeps NITRO_PORT=0", () => {
    vi.stubEnv("NITRO_PORT", "0");
    vi.stubEnv("PORT", "4002");
    expect(resolveServeOptions({ fetch }).port).toBe(0);
  });

  it("keeps PORT=0", () => {
    vi.stubEnv("NITRO_PORT", "");
    vi.stubEnv("PORT", "0");
    expect(resolveServeOptions({ fetch }).port).toBe(0);
  });

  it("defaults to 3000", () => {
    vi.stubEnv("NITRO_PORT", "");
    vi.stubEnv("PORT", "");
    expect(resolveServeOptions({ fetch }).port).toBe(3000);
  });
});
