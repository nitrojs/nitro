import { Miniflare } from "miniflare";
import { resolve } from "pathe";
import { Response as _Response } from "undici";
import { describe } from "vitest";

import { setupTest, testNitro } from "../tests";

describe("nitro:preset:cloudflare-module-legacy", async () => {
  const ctx = await setupTest("cloudflare-module-legacy", {});

  testNitro(ctx, () => {
    const mf = new Miniflare({
      modules: true,
      scriptPath: resolve(ctx.outDir, "server/index.mjs"),
      modulesRules: [{ type: "CompiledWasm", include: ["**/*.wasm"] }],
      sitePath: resolve(ctx.outDir, "public"),
      compatibilityFlags: ["streams_enable_constructors"],
      bindings: { ...ctx.env },
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
