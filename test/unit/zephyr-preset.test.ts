import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const ZEPHYR_UTILS_PATH = "../../src/presets/zephyr/utils.ts";
const ZEPHYR_PRESET_PATH = "../../src/presets/zephyr/preset.ts";

async function getZephyrPreset() {
  const { default: presets } = await import(ZEPHYR_PRESET_PATH);
  return presets[0];
}

describe("zephyr preset", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock(ZEPHYR_UTILS_PATH);
  });

  it("extends base-worker", async () => {
    const preset = await getZephyrPreset();
    expect(preset.extends).toBe("base-worker");
    expect(preset.output?.publicDir).toBe("{{ output.dir }}/client/{{ baseURL }}");
    expect(preset.commands?.deploy).toBe("node ./.zephyr/deploy.mjs");
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
    const writeZephyrDeployArtifacts = vi.fn().mockResolvedValue(undefined);
    const uploadNitroOutputToZephyr = vi.fn().mockResolvedValue({
      deploymentUrl: "https://example.zephyr-cloud.io",
      entrypoint: "server/index.mjs",
    });

    vi.doMock(ZEPHYR_UTILS_PATH, async () => {
      const actual =
        await vi.importActual<typeof import("../../src/presets/zephyr/utils.ts")>(
          ZEPHYR_UTILS_PATH
        );
      return {
        ...actual,
        uploadNitroOutputToZephyr,
        writeZephyrDeployArtifacts,
      };
    });

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

    expect(writeZephyrDeployArtifacts).toHaveBeenCalledWith({
      outputDir: "/tmp/zephyr-output",
    });
    expect(uploadNitroOutputToZephyr).toHaveBeenCalledWith({
      rootDir: "/tmp/project",
      baseURL: "/docs/",
      outputDir: "/tmp/zephyr-output",
      publicDir: "/tmp/zephyr-output/client/docs",
    });
    expect(nitro.logger.success).toHaveBeenCalledWith(
      "[zephyr-nitro-preset] Zephyr deployment succeeded."
    );
    expect(nitro.logger.info).not.toHaveBeenCalled();
  });

  it("can skip deploy on build", async () => {
    const writeZephyrDeployArtifacts = vi.fn().mockResolvedValue(undefined);
    const uploadNitroOutputToZephyr = vi.fn().mockResolvedValue({
      deploymentUrl: "https://example.zephyr-cloud.io",
      entrypoint: "server/index.mjs",
    });

    vi.doMock(ZEPHYR_UTILS_PATH, async () => {
      const actual =
        await vi.importActual<typeof import("../../src/presets/zephyr/utils.ts")>(
          ZEPHYR_UTILS_PATH
        );
      return {
        ...actual,
        uploadNitroOutputToZephyr,
        writeZephyrDeployArtifacts,
      };
    });

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

    expect(writeZephyrDeployArtifacts).toHaveBeenCalledWith({
      outputDir: "/tmp/zephyr-output",
    });
    expect(uploadNitroOutputToZephyr).not.toHaveBeenCalled();
    expect(nitro.logger.info).toHaveBeenCalledWith(
      "[zephyr-nitro-preset] Zephyr deploy skipped (zephyr.deployOnBuild=false)."
    );
    expect(nitro.logger.success).not.toHaveBeenCalled();
  });

  it("writes .zephyr deployment files", async () => {
    const { writeZephyrDeployArtifacts } = await import(ZEPHYR_UTILS_PATH);
    const outputDir = await mkdtemp(join(tmpdir(), "nitro-zephyr-"));

    await writeZephyrDeployArtifacts({ outputDir });

    const meta = JSON.parse(
      await readFile(resolve(outputDir, ".zephyr/meta.json"), "utf8")
    ) as Record<string, any>;
    const deployScript = await readFile(resolve(outputDir, ".zephyr/deploy.mjs"), "utf8");

    expect(meta.version).toBe(1);
    expect(meta.output).toEqual({
      serverDir: "server",
      clientDir: "client",
    });
    expect(meta.snapshotType).toBe("ssr");
    expect(meta.target).toBe("web");
    expect(deployScript).toContain('from "zephyr-agent"');
    expect(deployScript).toContain("readDirRecursiveWithContents");

    const check = spawnSync(process.execPath, [
      "--check",
      resolve(outputDir, ".zephyr/deploy.mjs"),
    ]);
    expect(check.status).toBe(0);
  });
});
