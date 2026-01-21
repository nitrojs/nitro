import { promises as fsp } from "node:fs";
import { resolve } from "pathe";
import { describe, expect, it } from "vitest";

import { setupTest } from "../tests.ts";

describe("nitro:preset:cloudflare-durable", async () => {
  const ctx = await setupTest("cloudflare-durable");

  it("should use custom durable binding name from config", async () => {
    const entry = await fsp.readFile(
      resolve(ctx.outDir, "server", "chunks", "nitro", "nitro.mjs"),
      "utf8"
    );
    // Check that custom binding name is used instead of default $DurableObject
    expect(entry).toContain("MyCustomDO");
  });

  it("should export $DurableObject class", async () => {
    const entry = await fsp.readFile(
      resolve(ctx.outDir, "server", "index.mjs"),
      "utf8"
    );
    expect(entry).toMatch(/\$DurableObject/);
  });
});
