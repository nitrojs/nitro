import { describe, expect, it, vi } from "vitest";

import { externals } from "../../src/build/plugins/externals.ts";

vi.mock("node:module", async (importOriginal) => {
  const mod = await importOriginal<typeof import("node:module")>();
  return {
    ...mod,
    builtinModules: [...mod.builtinModules, "ws", "undici", "bun", "bun:ffi", "node:sqlite"],
  };
});

function createHandler() {
  const plugin = externals({
    rootDir: "/app",
    conditions: ["node"],
    exclude: [],
    include: [],
    trace: false,
  });
  return (plugin.resolveId as any).handler.bind({ resolve: async () => null });
}

describe("nitro:externals builtins", () => {
  it("keeps runtime-specific bare builtins unprefixed", async () => {
    const resolveId = createHandler();
    for (const id of ["ws", "undici", "bun"]) {
      expect(await resolveId(id, "/app/index.js", {})).toMatchObject({
        external: true,
        id,
      });
    }
  });

  it("prefixes Node builtins with node:", async () => {
    const resolveId = createHandler();
    expect(await resolveId("fs", "/app/index.js", {})).toMatchObject({
      external: true,
      id: "node:fs",
    });
  });

  it("preserves prefixed builtin ids", async () => {
    const resolveId = createHandler();
    expect(await resolveId("node:sqlite", "/app/index.js", {})).toMatchObject({
      external: true,
      id: "node:sqlite",
    });
    expect(await resolveId("bun:ffi", "/app/index.js", {})).toMatchObject({
      external: true,
      id: "bun:ffi",
    });
  });
});
