import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, describe, expect, it } from "vitest";
import { enableNodeCompat } from "../../src/presets/cloudflare/utils";

const roots: string[] = [];

function createNitroStub(wranglerConfig: Record<string, unknown>) {
  const rootDir = mkdtempSync(join(tmpdir(), "nitro-cf-node-compat-"));
  roots.push(rootDir);
  writeFileSync(join(rootDir, "wrangler.json"), JSON.stringify(wranglerConfig));
  return {
    options: {
      rootDir,
      cloudflare: { deployConfig: false },
      unenv: [],
      rollupConfig: { plugins: [] },
    },
    logger: { warn: () => {} },
  } as any;
}

describe("enableNodeCompat", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    [{ compatibility_date: "2026-08-03" }, undefined],
    [{ compatibility_date: "2026-08-04" }, true],
    [{ compatibility_date: "2026-09-13" }, true],
    [
      {
        compatibility_date: "2024-09-23",
        compatibility_flags: ["nodejs_compat"],
      },
      true,
    ],
    [
      {
        compatibility_date: "2026-09-13",
        compatibility_flags: ["no_nodejs_compat"],
      },
      undefined,
    ],
    [{}, undefined],
  ])(
    "infers nodeCompat from wrangler config %j",
    async (wranglerConfig, expected) => {
      const nitro = createNitroStub(wranglerConfig);
      await enableNodeCompat(nitro);
      expect(nitro.options.cloudflare.nodeCompat).toBe(expected);
    }
  );
});
