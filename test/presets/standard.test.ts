import { resolve } from "pathe";
import { describe } from "vitest";
import { setupTest, testNitro } from "../tests.ts";

describe("nitro:standard", async () => {
  const ctx = await setupTest("standard");

  testNitro(ctx, async () => {
    const entryPath = resolve(ctx.outDir, "server/index.mjs");
    const fetchHandler = await import(entryPath).then((m) => m.default.fetch);

    return async ({ url, ...init }) => {
      const res = await fetchHandler(new Request(`https://test.com${url}`, init));
      return res;
    };
  });
});
