import { promises as fsp } from "node:fs";
import { resolve } from "pathe";
import { describe, expect, it } from "vitest";

import { setupTest } from "../tests.ts";

describe("nitro:preset:cloudflare-durable", async () => {
  const staticCtx = await setupTest("cloudflare-durable", {
    outDirSuffix: "-static",
    config: {
      cloudflare: {
        durable: {
          bindingName: "MyCustomDO",
          instanceName: "app-server",
        },
      },
    },
  });

  const resolverCtx = await setupTest("cloudflare-durable", {
    outDirSuffix: "-resolver",
    config: {
      cloudflare: {
        durable: {
          bindingName: "ResolverDO",
          instanceName: "fallback-server",
          resolver: "./server/utils/cloudflare-durable-resolver.ts",
        },
      },
    },
  });

  it("uses custom durable binding and instance names in the built worker", async () => {
    const entry = await fsp.readFile(resolve(staticCtx.outDir, "server", "index.mjs"), "utf8");

    expect(entry).toContain('bindingName: "MyCustomDO"');
    expect(entry).toContain('instanceName: "app-server"');
    expect(entry).not.toContain('instanceName: "server"');
  });

  it("generates a durable object binding for the configured binding name", async () => {
    const wranglerConfig = await fsp
      .readFile(resolve(staticCtx.outDir, "server", "wrangler.json"), "utf8")
      .then((r) => JSON.parse(r));

    expect(wranglerConfig.durable_objects?.bindings).toEqual([
      {
        name: "MyCustomDO",
        class_name: "$DurableObject",
      },
    ]);
  });

  it("bundles the configured resolver module into the worker entry", async () => {
    const entry = await fsp.readFile(resolve(resolverCtx.outDir, "server", "index.mjs"), "utf8");

    expect(entry).toContain("const resolveInstanceName =");
    expect(entry).toContain("resolveInstanceName");
    expect(entry).toContain('searchParams.get("room")');
    expect(entry).toContain('instanceName: "fallback-server"');
  });
});
