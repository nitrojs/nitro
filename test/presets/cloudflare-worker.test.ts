import { Miniflare } from "miniflare";
import { resolve } from "pathe";
import { describe } from "vitest";

import { setupTest, testNitro } from "../tests";

describe("nitro:preset:cloudflare-worker", async () => {
  const ctx = await setupTest("cloudflare-worker");
  testNitro(ctx, () => {
    const mf = new Miniflare({
      scriptPath: resolve(ctx.outDir, "server/index.mjs"),
      bindings: { ...ctx.env },
      compatibilityFlags: ["streams_enable_constructors"],
    });
    return async ({ url, headers, method, body }) => {
      const res = await mf.dispatchFetch("http://localhost" + url, {
        headers: headers || {},
        method: method || "GET",
        redirect: "manual",
        body,
      });
      return res as unknown as Response;
    };
  });
});
