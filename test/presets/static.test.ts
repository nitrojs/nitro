import fsp from "node:fs/promises";
import { resolve } from "pathe";
import { describe, it, expect } from "vitest";
import { setupTest } from "../tests";

describe("nitro:preset:static", async () => {
  const ctx = await setupTest("static");
  it("should not generate a server folder", async () => {
    const contents = await fsp.readdir(resolve(ctx.outDir));
    expect(contents).toMatchInlineSnapshot(`
      [
        "nitro.json",
        "public",
      ]
    `);
  });
});
