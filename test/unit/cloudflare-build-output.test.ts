import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadBuildOutputConfig,
  resolveBuildOutputConfig,
} from "../../src/presets/cloudflare/build-output-config.ts";

const roots: string[] = [];

async function resolveConfig(nitro: any) {
  await loadBuildOutputConfig(nitro);
  return resolveBuildOutputConfig(nitro);
}

function createNitroStub(
  overrides: {
    static?: boolean;
    compatibilityDate?: string;
    mode?: string;
    viteMode?: string;
    config?: string;
    files?: Record<string, string>;
  } = {}
) {
  const root = mkdtempSync(join(tmpdir(), "nitro-cf-build-output-"));
  roots.push(root);
  if (overrides.config) {
    writeFileSync(join(root, "cloudflare.config.ts"), overrides.config);
  }
  for (const [file, contents] of Object.entries(overrides.files || {})) {
    writeFileSync(join(root, file), contents);
  }
  return {
    options: {
      static: overrides.static ?? false,
      rootDir: root,
      workspaceDir: root,
      compatibilityDate: {
        cloudflare: overrides.compatibilityDate ?? "2025-10-24",
        default: overrides.compatibilityDate ?? "2025-10-24",
      },
      cloudflare: { nodeCompat: true, mode: overrides.mode },
      _vite: overrides.viteMode ? { mode: overrides.viteMode } : undefined,
      experimental: { tasks: true },
      scheduledTasks: { "* * * * *": "test" },
    },
    logger: { info: vi.fn(), warn: vi.fn() },
  } as any;
}

const modeConfig = /* ts */ `
export default ({ mode, isPreview }: { mode?: string; isPreview: boolean }) => ({
  accountId: "acc-123",
  worker: {
    name: "app-" + (mode ?? "none") + (isPreview ? "-preview" : ""),
    compatibilityDate: "2025-01-01",
  },
});
`;

describe("resolveBuildOutputConfig (cloudflare)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("uses Nitro defaults without `cloudflare.config.ts`", async () => {
    const nitro = createNitroStub();
    const { settings, buildContext, worker } = await resolveConfig(nitro);
    expect(settings).toEqual({});
    expect(buildContext).toEqual({ isPreview: false, mode: undefined });
    expect(worker).toEqual({
      name: expect.any(String),
      compatibilityDate: "2025-10-24",
      env: { ASSETS: { type: "assets" } },
      triggers: [{ type: "scheduled", schedule: "* * * * *" }],
    });
  });

  it("does not add the `nodejs_compat` flag", async () => {
    const nitro = createNitroStub({ compatibilityDate: "2025-01-01" });
    const { worker } = await resolveConfig(nitro);
    expect(worker.compatibilityFlags).toBeUndefined();
  });

  it("evaluates `cloudflare.config.ts` with the build context", async () => {
    vi.stubEnv("CLOUDFLARE_PREVIEW_BUILD", "true");
    const nitro = createNitroStub({ config: modeConfig, viteMode: "production" });
    const { settings, buildContext, worker } = await resolveConfig(nitro);
    expect(settings).toEqual({ accountId: "acc-123" });
    expect(buildContext).toEqual({ isPreview: true, mode: "production" });
    expect(worker.name).toBe("app-production-preview");
  });

  it("resolves the mode from the option, then the environment, then Vite", async () => {
    vi.stubEnv("CLOUDFLARE_BUILD_MODE", "staging");
    const fromEnv = await resolveConfig(
      createNitroStub({ config: modeConfig, viteMode: "production" })
    );
    expect(fromEnv.worker.name).toBe("app-staging");

    const fromOption = await resolveConfig(
      createNitroStub({ config: modeConfig, viteMode: "production", mode: "qa" })
    );
    expect(fromOption.buildContext.mode).toBe("qa");
    expect(fromOption.worker.name).toBe("app-qa");
  });

  it("merges Nitro additions into the user config", async () => {
    const nitro = createNitroStub({
      config: /* ts */ `export default {
        worker: {
          name: "app",
          compatibilityDate: "2025-01-01",
          entrypoint: "./server.ts",
          compatibilityFlags: ["nodejs_als"],
          env: { STATIC: { type: "assets" }, KV: { type: "kv", id: "abc" } },
          triggers: [{ type: "scheduled", schedule: "* * * * *" }],
        },
      };`,
    });
    const { worker } = await resolveConfig(nitro);
    expect(worker).toEqual({
      name: "app",
      compatibilityDate: "2025-01-01",
      compatibilityFlags: ["nodejs_als"],
      env: { STATIC: { type: "assets" }, KV: { type: "kv", id: "abc" } },
      triggers: [{ type: "scheduled", schedule: "* * * * *" }],
    });
    expect(nitro.logger.warn).toHaveBeenCalledWith(expect.stringContaining("`entrypoint`"));
  });

  it("applies Nitro additions with the options updated after loading (e.g. by modules)", async () => {
    const nitro = createNitroStub();
    await loadBuildOutputConfig(nitro);
    nitro.options.scheduledTasks["0 0 * * *"] = "nightly";
    const { worker } = resolveBuildOutputConfig(nitro);
    expect(worker.triggers).toEqual([
      { type: "scheduled", schedule: "* * * * *" },
      { type: "scheduled", schedule: "0 0 * * *" },
    ]);
  });

  it("does not bind assets or add triggers for static builds", async () => {
    const { worker } = await resolveConfig(createNitroStub({ static: true }));
    expect(worker.env).toBeUndefined();
    expect(worker.triggers).toBeUndefined();
  });

  it("throws for an invalid `cloudflare.config.ts`", async () => {
    const nitro = createNitroStub({ config: `export default { worker: { name: "app" } };` });
    await expect(resolveConfig(nitro)).rejects.toThrow(
      /Invalid `cloudflare\.config\.ts`:\n.*compatibilityDate/
    );
  });

  it("warns that Wrangler config is ignored", async () => {
    const nitro = createNitroStub({ files: { "wrangler.json": "{}" } });
    await resolveConfig(nitro);
    expect(nitro.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Wrangler config in `wrangler.json` is ignored")
    );
  });
});
