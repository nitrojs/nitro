import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { externals } from "../../src/build/plugins/externals.ts";
import { builtins, isNodeBuiltin } from "../../src/build/plugins/builtins.ts";

// Bun lists its own modules as builtins, and `isBuiltin()` is true for them with a `node:` prefix
vi.mock("node:module", async (importOriginal) => {
  const mod = await importOriginal<typeof import("node:module")>();
  const bunBuiltins = ["bun", "undici", "ws"];
  return {
    ...mod,
    builtinModules: [...mod.builtinModules, ...bunBuiltins, "bun:sqlite"],
    isBuiltin: (id: string) =>
      mod.isBuiltin(id) || id.startsWith("bun:") || bunBuiltins.includes(id.replace(/^node:/, "")),
  };
});

describe("runtime builtins (#4999)", () => {
  it("are not node builtins", () => {
    expect(
      ["fs", "node:fs", "fs/promises", "bun:sqlite"].filter((id) => isNodeBuiltin(id))
    ).toEqual(["fs", "node:fs", "fs/promises", "bun:sqlite"]);
    expect(["bun", "undici", "ws"].filter((id) => isNodeBuiltin(id))).toEqual([]);
  });

  it("are externalized without `node:` prefix, except npm packages", () => {
    expect(builtins).toEqual(expect.arrayContaining(["fs", "node:fs", "bun", "bun:sqlite"]));
    expect(builtins.filter((id) => /^(node:)?(undici|ws)$|^node:bun$/.test(id))).toEqual([]);
  });

  it("are resolved by the externals plugin", async () => {
    const plugin = externals({
      rootDir: process.cwd(),
      conditions: ["default"],
      exclude: [],
      include: [],
      trace: false,
    });
    const { handler } = plugin.resolveId as {
      handler: (id: string, importer: string | undefined, opts: any) => Promise<any>;
    };
    const context = { resolve: async (id: string) => ({ id: `/resolved/${id}` }) };

    expect(await handler.call(context, "fs", undefined, {})).toEqual({
      resolvedBy: "nitro:externals",
      external: true,
      id: "node:fs",
    });
    for (const id of ["ws", "undici", "bun"]) {
      expect(await handler.call(context, id, undefined, {})).toEqual({
        resolvedBy: "nitro:externals",
        external: true,
        id: pathToFileURL(`/resolved/${id}`).href,
      });
    }
  });
});
