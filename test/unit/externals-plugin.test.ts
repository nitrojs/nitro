import { describe, expect, it } from "vitest";
import { externals } from "../../src/build/plugins/externals.ts";

describe("nitro:externals plugin", () => {
  it("does not force node: prefix for runtime-augmented modules like ws under bun (#4999)", async () => {
    const plugin = externals({
      rootDir: process.cwd(),
      conditions: ["default"],
      exclude: [],
      include: [],
      trace: false,
    });

    const resolveId = plugin.resolveId as {
      handler: (id: string, importer: string | undefined, rOpts: any) => Promise<any>;
    };

    let resolvedCall: string | undefined;
    const context = {
      resolve: async (id: string) => {
        resolvedCall = id;
        return { id: `/resolved/${id}` };
      },
    };

    // Node core builtin gets normalized to node: prefix
    const fsRes = await resolveId.handler.call(context, "fs", undefined, {});
    expect(fsRes).toEqual({
      resolvedBy: "nitro:externals",
      external: true,
      id: "node:fs",
    });

    // Runtime-augmented modules (ws, undici, bun) must not get node: prefix
    for (const mod of ["ws", "undici", "bun"]) {
      resolvedCall = undefined;
      const res = await resolveId.handler.call(context, mod, undefined, {});
      // Instead of short-circuiting to node:mod, it delegates to regular resolution
      expect(res?.id).not.toBe(`node:${mod}`);
      expect(resolvedCall).toBe(mod);
    }
  });
});
