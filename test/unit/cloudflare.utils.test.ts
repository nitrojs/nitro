import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeWranglerConfig } from "../../src/presets/cloudflare/utils";

function createNitroStub(compatibilityDate: string) {
  const root = mkdtempSync(join(tmpdir(), "nitro-cf-wrangler-"));
  return {
    root,
    nitro: {
      options: {
        baseURL: "/",
        rootDir: root,
        workspaceDir: root,
        output: {
          dir: join(root, ".output"),
          serverDir: join(root, ".output/server"),
          publicDir: join(root, ".output/public"),
        },
        compatibilityDate: {
          cloudflare: compatibilityDate,
          default: compatibilityDate,
        },
        cloudflare: { deployConfig: true, nodeCompat: true },
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
    } as any,
  };
}

describe("writeWranglerConfig", () => {
  let cleanup: string[] = [];

  beforeEach(() => {
    cleanup = [];
  });

  afterEach(() => {
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.each([
    ["", ["nodejs_compat", "no_nodejs_compat_v2"]],
    ["2024-04-03", ["nodejs_compat", "no_nodejs_compat_v2"]],
    ["2024-09-22", ["nodejs_compat", "no_nodejs_compat_v2"]],
    ["2024-09-23", ["nodejs_compat", "no_nodejs_compat_v2"]],
    ["2024-09-24", ["nodejs_compat", "no_nodejs_compat_v2"]],
    ["2026-08-03", ["nodejs_compat", "no_nodejs_compat_v2"]],
    ["2026-08-04", ["no_nodejs_compat_v2"]],
    ["2026-08-05", ["no_nodejs_compat_v2"]],
  ])(
    "uses the required Node.js compatibility flags for compatibility date %s",
    async (compatibilityDate, expected) => {
      const { root, nitro } = createNitroStub(compatibilityDate);
      cleanup.push(root);
      await writeWranglerConfig(nitro, "module");
      const config = JSON.parse(
        readFileSync(join(root, ".output/server/wrangler.json"), "utf8")
      );
      expect(config.compatibility_flags).toEqual(expected);
    }
  );
});
