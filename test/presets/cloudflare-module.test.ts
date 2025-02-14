import { Miniflare } from "miniflare";
import { resolve } from "pathe";
import { Response as _Response } from "undici";
import { describe } from "vitest";

import { setupTest, testNitro } from "../tests";

describe("nitro:preset:cloudflare-module", async () => {
  const ctx = await setupTest("cloudflare-module");

  testNitro(ctx, () => {
    const mf = new Miniflare({
      modules: true,
      scriptPath: resolve(ctx.outDir, "server/index.mjs"),
      modulesRules: [{ type: "CompiledWasm", include: ["**/*.wasm"] }],
      assets: {
        directory: resolve(ctx.outDir, "public"),
        routingConfig: { has_user_worker: true },
        assetConfig: {
          // https://developers.cloudflare.com/workers/static-assets/routing/#routing-configuration
          html_handling: "auto-trailing-slash" /* default */,
          not_found_handling: "none" /* default */,
        },
      },
      compatibilityFlags: [
        "streams_enable_constructors",
        "nodejs_compat",
        "no_nodejs_compat_v2",
      ],
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
