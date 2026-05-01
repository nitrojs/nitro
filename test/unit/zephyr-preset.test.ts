import { afterEach, describe, expect, it, vi } from "vitest";

const ZEPHYR_PRESET_PATH = "../../src/presets/zephyr/preset.ts";

const importDepMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/utils/dep.ts", () => ({
  importDep: importDepMock,
}));

async function getZephyrPreset() {
  const { default: presets } = await import(ZEPHYR_PRESET_PATH);
  return presets[0];
}

describe("zephyr preset", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.resetModules();
    delete (globalThis as any).__nitroDeploying__;
    delete process.env.NITRO_INTERNAL_ZEPHYR_SKIP_DEPLOY_ON_BUILD;
  });

  it("extends base-worker", async () => {
    const preset = await getZephyrPreset();
    expect(preset.extends).toBe("base-worker");
    expect(preset.output?.publicDir).toBe("{{ output.dir }}/client/{{ baseURL }}");
    expect(preset.commands?.deploy).toBeUndefined();
  });

  it("adds cloudflare unenv presets", async () => {
    const preset = await getZephyrPreset();
    const hooks = preset.hooks!;

    const nitro = {
      options: {
        preset: "zephyr",
        output: {
          dir: "/tmp/zephyr-output",
          serverDir: "/tmp/zephyr-output/server",
        },
        unenv: [],
      },
      logger: {
        info: vi.fn(),
        success: vi.fn(),
      },
    } as any;

    await hooks["build:before"]?.(nitro);
    expect(nitro.options.unenv).toHaveLength(2);
    expect(nitro.options.unenv[0].meta?.name).toBe("nitro:cloudflare-externals");
    expect(nitro.options.unenv[1].meta?.name).toBe("nitro:cloudflare-node-compat");
    expect(nitro.logger.info).not.toHaveBeenCalled();
    expect(nitro.logger.success).not.toHaveBeenCalled();
  });

  it("deploys on compiled hook by default", async () => {
    const uploadOutputToZephyr = vi.fn().mockResolvedValue({
      deploymentUrl: "https://example.zephyr-cloud.io",
      entrypoint: "server/index.mjs",
    });
    importDepMock.mockResolvedValue({ uploadOutputToZephyr });

    (globalThis as any).__nitroDeploying__ = true;

    const preset = await getZephyrPreset();

    const hooks = preset.hooks!;
    const nitro = {
      options: {
        rootDir: "/tmp/project",
        baseURL: "/docs/",
        output: {
          dir: "/tmp/zephyr-output",
          publicDir: "client/docs",
        },
      },
      logger: {
        info: vi.fn(),
        success: vi.fn(),
      },
    } as any;

    await hooks.compiled?.(nitro);

    expect(importDepMock).toHaveBeenCalledWith({
      id: "zephyr-agent",
      reason: "deploying to Zephyr",
      dir: "/tmp/project",
    });
    expect(uploadOutputToZephyr).toHaveBeenCalledWith({
      rootDir: "/tmp/project",
      baseURL: "/docs/",
      outputDir: "/tmp/zephyr-output",
      publicDir: "/tmp/zephyr-output/client/docs",
    });
    expect(nitro.logger.success).toHaveBeenCalledWith(
      "[zephyr-nitro-preset] Zephyr deployment succeeded: https://example.zephyr-cloud.io"
    );
    expect(nitro.logger.info).not.toHaveBeenCalled();
  });

  it("can skip deploy on build", async () => {
    const uploadOutputToZephyr = vi.fn().mockResolvedValue({
      deploymentUrl: "https://example.zephyr-cloud.io",
      entrypoint: "server/index.mjs",
    });
    importDepMock.mockResolvedValue({ uploadOutputToZephyr });

    const preset = await getZephyrPreset();
    const hooks = preset.hooks!;
    const nitro = {
      options: {
        zephyr: {
          deployOnBuild: false,
        },
        output: {
          dir: "/tmp/zephyr-output",
        },
      },
      logger: {
        info: vi.fn(),
        success: vi.fn(),
      },
    } as any;

    await hooks.compiled?.(nitro);

    expect(importDepMock).not.toHaveBeenCalled();
    expect(uploadOutputToZephyr).not.toHaveBeenCalled();
    expect(nitro.logger.info).toHaveBeenCalledWith(
      "[zephyr-nitro-preset] Zephyr deploy skipped on build."
    );
    expect(nitro.logger.success).not.toHaveBeenCalled();
  });
});
