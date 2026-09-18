import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeWranglerConfig } from "../../src/presets/cloudflare/utils.ts";

function createNitroStub(overrides: { static?: boolean; compatibilityDate?: string } = {}) {
  const root = mkdtempSync(join(tmpdir(), "nitro-cf-wrangler-"));
  const date = overrides.compatibilityDate ?? "2025-10-24";
  return {
    root,
    nitro: {
      options: {
        static: overrides.static ?? false,
        baseURL: "/",
        rootDir: root,
        workspaceDir: root,
        output: {
          dir: join(root, ".output"),
          serverDir: join(root, ".output/server"),
          publicDir: join(root, ".output/public"),
        },
        compatibilityDate: { cloudflare: date, default: date },
        cloudflare: { deployConfig: true, nodeCompat: true },
        experimental: {},
        scheduledTasks: {},
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
      },
    } as any,
  };
}

describe("writeWranglerConfig (cloudflare-module)", () => {
  let cleanup: string[] = [];
  beforeEach(() => {
    cleanup = [];
  });
  afterEach(() => {
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("emits main and ASSETS binding for a normal (non-static) build", async () => {
    const { root, nitro } = createNitroStub({ static: false });
    cleanup.push(root);
    await writeWranglerConfig(nitro, "module");
    const config = JSON.parse(readFileSync(join(root, ".output/server/wrangler.json"), "utf8"));
    expect(config.main).toBe("index.mjs");
    expect(config.assets).toEqual({ binding: "ASSETS", directory: "../public" });
    expect(config.no_bundle).toBe(true);
    expect(config.rules).toEqual([{ type: "ESModule", globs: ["**/*.mjs", "**/*.js"] }]);
  });

  it("omits main, ASSETS binding and module bundling rules for a static build", async () => {
    // Regression test for nuxt/nuxt#34186 — `nuxt generate` (which sets
    // `nitro.options.static = true`) targeting cloudflare_module previously
    // wrote a wrangler.json pointing at a non-existent index.mjs.
    const { root, nitro } = createNitroStub({ static: true });
    cleanup.push(root);
    await writeWranglerConfig(nitro, "module");
    const config = JSON.parse(readFileSync(join(root, ".output/server/wrangler.json"), "utf8"));
    expect(config.main).toBeUndefined();
    expect(config.assets).toEqual({ directory: "../public" });
    expect(config.no_bundle).toBeUndefined();
    expect(config.rules).toBeUndefined();
  });

  it("adds nodejs_compat while the flag still needs to be explicit", async () => {
    const { root, nitro } = createNitroStub({ compatibilityDate: "2026-08-03" });
    cleanup.push(root);
    await writeWranglerConfig(nitro, "module");
    const config = JSON.parse(readFileSync(join(root, ".output/server/wrangler.json"), "utf8"));
    expect(config.compatibility_flags).toContain("nodejs_compat");
  });

  it("omits nodejs_compat once workerd enables it by default", async () => {
    // Regression test for nitrojs/nitro#4527 — from compatibility date
    // 2026-08-04 workerd enables nodejs_compat by default and rejects an
    // explicit flag as a hard error, so the generated config must omit it.
    const { root, nitro } = createNitroStub({ compatibilityDate: "2026-08-04" });
    cleanup.push(root);
    await writeWranglerConfig(nitro, "module");
    const config = JSON.parse(readFileSync(join(root, ".output/server/wrangler.json"), "utf8"));
    expect(config.compatibility_date).toBe("2026-08-04");
    expect(config.compatibility_flags ?? []).not.toContain("nodejs_compat");
  });
});
