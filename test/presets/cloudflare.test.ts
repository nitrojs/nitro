import { promises as fsp } from "node:fs";
import { resolve } from "pathe";
import { Miniflare } from "miniflare";
import { describe, it, expect } from "vitest";

import { setupTest, testNitro } from "../tests";

describe("nitro:preset:cloudflare", async () => {
  const ctx = await setupTest("cloudflare");
  testNitro(ctx, () => {
    const mf = new Miniflare({
      scriptPath: resolve(ctx.outDir, "server/index.mjs"),
      globals: { ...ctx.env },
      compatibilityFlags: ["streams_enable_constructors"],
    });
    return async ({ url, headers, method, body }) => {
      const res = await mf.dispatchFetch("http://localhost" + url, {
        headers: headers || {},
        method: method || "GET",
        body,
      });
      return res as unknown as Response;
    };
  });
});
