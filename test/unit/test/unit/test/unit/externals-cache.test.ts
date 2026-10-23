import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveModuleURL: vi.fn(
    (_id: string) => "file:///project/node_modules/defu/dist/defu.mjs"
  ),
}));

vi.mock("exsolve", async (importOriginal) => {
  const mod = await importOriginal<typeof import("exsolve")>();
  return { ...mod, resolveModuleURL: mocks.resolveModuleURL };
});

const resolveModuleURL = mocks.resolveModuleURL;

import { externals } from "../../src/rollup/plugins/externals";

describe("externals:resolveId caching (#4799)", () => {
  const makePlugin = () =>
    externals({
      outDir: "",
      moduleDirectories: [],
      exportConditions: ["node", "import", "default"],
    });
  const context = { resolve: () => null };

  it("reuses resolution results for the same id and importer directory", async () => {
    const plugin = makePlugin();
    await (plugin.resolveId as any).call(context, "defu", "/project/src/a.js", {});
    const callsAfterFirst = resolveModuleURL.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    // Same id, different importer in the same directory: no re-resolution
    await (plugin.resolveId as any).call(context, "defu", "/project/src/b.js", {});
    expect(resolveModuleURL.mock.calls.length).toBe(callsAfterFirst);
  });

  it("re-resolves when the importer directory differs", async () => {
    const plugin = makePlugin();
    await (plugin.resolveId as any).call(context, "defu", "/project/src/a.js", {});
    const callsAfterFirst = resolveModuleURL.mock.calls.length;
    await (plugin.resolveId as any).call(context, "defu", "/other/dir/a.js", {});
    expect(resolveModuleURL.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });
});
