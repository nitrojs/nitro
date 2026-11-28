import { existsSync } from "node:fs";
import fsp from "node:fs/promises";
import { resolve } from "pathe";
import { describe, expect, it } from "vitest";
import { setupTest } from "../tests.ts";

describe("nitro:preset:zeabur-static", async () => {
  const ctx = await setupTest("zeabur-static");

  it("should not generate a server folder", async () => {
    const contents = await fsp.readdir(resolve(ctx.outDir));
    expect(contents).toMatchInlineSnapshot(`
      [
        "nitro.json",
        "public",
      ]
    `);
  });

  it("output has public directory", async () => {
    // make output directory aligned with `nuxt generate`'s
    // output directory, which is ".output/public"
    expect(existsSync(resolve(ctx.outDir, "public", "favicon.ico"))).toBe(true);
  });
});

describe("nitro:preset:zeabur", async () => {
  const ctx = await setupTest("zeabur");

  it("output directory is .output/server and has index.mjs", async () => {
    // Zeabur sets ".output/server/index.mjs" as the entry point
    // https://github.com/zeabur/zbpack/blob/b8d76b5758fed32203cbdbf0456a9bc5c948dfc0/internal/nodejs/plan.go#L883
    expect(existsSync(resolve(ctx.outDir, "server", "index.mjs"))).toBe(true);
  });
});
