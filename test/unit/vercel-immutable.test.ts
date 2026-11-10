import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { describe, expect, it, vi } from "vitest";
import type { Nitro } from "nitropack/types";
import { createNitro as createRealNitro } from "../../src/core/nitro";
import { setupImmutableStaticFiles } from "../../src/presets/vercel/immutable";

function createNitro(options: {
  baseURL: string;
  immutableStaticFiles?: boolean;
}) {
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
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("non-root `baseURL`")
    );
  });

  it.each(["vercel", "vercel-static"])(
    "resolves buildAssetsDir during createNitro (%s)",
    async (preset) => {
      const rootDir = await mkdtemp(join(tmpdir(), "nitro-vercel-immutable-"));
      const nitro = await createRealNitro({
        preset,
        rootDir,
        logLevel: 0,
        vercel: { immutableStaticFiles: true },
      });
      try {
        // Available before `build()`, so frameworks building the client first
        // (e.g. Nuxt in `nitro:init`) can read it.
        expect(nitro.options.buildAssetsDir).toBe("_vercel/immutable/nitro");
      } finally {
        await nitro.close();
        await rm(rootDir, { recursive: true, force: true });
      }
    }
  );

  it("is a no-op when not enabled", () => {
    const { nitro, warn } = createNitro({
      baseURL: "/app/",
      immutableStaticFiles: false,
    });
    setupImmutableStaticFiles(nitro);
    expect(nitro.options.buildAssetsDir).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });
});
