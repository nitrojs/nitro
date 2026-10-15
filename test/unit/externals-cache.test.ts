import { resolve } from "pathe";
import { describe, expect, it, vi } from "vitest";
import { resolveModuleURL } from "exsolve";
import { externals } from "../../src/rollup/plugins/externals";

vi.mock("exsolve", async (importOriginal) => {
  const mod = await importOriginal<typeof import("exsolve")>();
  return {
    ...mod,
    resolveModuleURL: vi.fn(mod.resolveModuleURL),
  };
});

describe("externals:memoize tryResolve", () => {
  it("memoizes repeated module resolutions across chunks in the same directory", async () => {
    const resolveModuleURLMock = vi.mocked(resolveModuleURL);
    resolveModuleURLMock.mockClear();

    const plugin = externals({
      outDir: "",
      moduleDirectories: [resolve("node_modules")],
      exportConditions: ["node", "import", "default"],
    });

    const importer1 = resolve("test/fixture/routes/chunk-a.mjs");
    const importer2 = resolve("test/fixture/routes/chunk-b.mjs");

    // First call: resolves "defu" from importer1
    const result1 = await (plugin.resolveId as any).call(
      { resolve: () => null },
      "defu",
      importer1,
      {}
    );
    expect(result1).toEqual({ id: "defu", external: true });
    const callCountAfterFirst = resolveModuleURLMock.mock.calls.length;
    expect(callCountAfterFirst).toBeGreaterThan(0);

    // Second call: resolves "defu" from importer2 in the same directory
    const result2 = await (plugin.resolveId as any).call(
      { resolve: () => null },
      "defu",
      importer2,
      {}
    );
    expect(result2).toEqual({ id: "defu", external: true });

    // The second call must not invoke resolveModuleURL again because it was memoized
    expect(resolveModuleURLMock.mock.calls.length).toBe(callCountAfterFirst);

    // Third call: same importer1 should also be cached
    const result3 = await (plugin.resolveId as any).call(
      { resolve: () => null },
      "defu",
      importer1,
      {}
    );
    expect(result3).toEqual({ id: "defu", external: true });
    expect(resolveModuleURLMock.mock.calls.length).toBe(callCountAfterFirst);
  });

  it("memoizes unresolvable modules to avoid repeated filesystem probing", async () => {
    const resolveModuleURLMock = vi.mocked(resolveModuleURL);
    resolveModuleURLMock.mockClear();

    const plugin = externals({
      outDir: "",
      moduleDirectories: [resolve("node_modules")],
      exportConditions: ["node", "import", "default"],
    });

    const importer1 = resolve("test/fixture/routes/chunk-a.mjs");
    const importer2 = resolve("test/fixture/routes/chunk-b.mjs");
    const nonExistentId = "non-existent-pkg-for-cache-test";

    // First call: fails to resolve
    await (plugin.resolveId as any).call(
      { resolve: () => null },
      nonExistentId,
      importer1,
      {}
    );
    const callCountAfterFirst = resolveModuleURLMock.mock.calls.length;
    expect(callCountAfterFirst).toBeGreaterThan(0);

    // Second call: resolving the same non-existent module from importer2
    await (plugin.resolveId as any).call(
      { resolve: () => null },
      nonExistentId,
      importer2,
      {}
    );

    // Should hit cache and avoid re-calling resolveModuleURL
    expect(resolveModuleURLMock.mock.calls.length).toBe(callCountAfterFirst);
  });
});
