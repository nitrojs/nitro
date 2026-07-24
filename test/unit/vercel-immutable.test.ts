import { describe, expect, it, vi } from "vitest";
import type { Nitro } from "nitro/types";
import { setupImmutableStaticFiles } from "../../src/presets/vercel/immutable.ts";

function createNitro(options: { baseURL: string; immutableStaticFiles?: boolean }) {
  const warn = vi.fn();
  const nitro = {
    options: {
      baseURL: options.baseURL,
      framework: { name: "nitro" },
      vercel: { immutableStaticFiles: options.immutableStaticFiles ?? true },
    },
    logger: { withTag: () => ({ warn, info: vi.fn() }) },
  } as unknown as Nitro;
  return { nitro, warn };
}

describe("vercel: setupImmutableStaticFiles", () => {
  it("sets buildAssetsDir for a root baseURL", () => {
    const { nitro, warn } = createNitro({ baseURL: "/" });
    setupImmutableStaticFiles(nitro);
    expect(nitro.options.buildAssetsDir).toBe("_vercel/immutable/nitro");
    expect(nitro.options.vercel!.immutableStaticFiles).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it("disables and warns for a non-root baseURL", () => {
    const { nitro, warn } = createNitro({ baseURL: "/app/" });
    setupImmutableStaticFiles(nitro);
    expect(nitro.options.vercel!.immutableStaticFiles).toBe(false);
    expect(nitro.options.buildAssetsDir).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("non-root `baseURL`"));
  });

  it("is a no-op when not enabled", () => {
    const { nitro, warn } = createNitro({ baseURL: "/app/", immutableStaticFiles: false });
    setupImmutableStaticFiles(nitro);
    expect(nitro.options.buildAssetsDir).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });
});
