import { describe, expect, it, vi } from "vitest";
import zephyrPresets from "../../src/presets/zephyr/preset.ts";

describe("zephyr preset", () => {
  it("extends cloudflare-module", () => {
    const [preset] = zephyrPresets;
    expect(preset.extends).toBe("cloudflare-module");
  });

  it("emits zephyr metadata asset in rollup:before", async () => {
    const [preset] = zephyrPresets;
    const hooks = preset.hooks!;

    const nitro = {
      options: {
        preset: "zephyr",
        output: {
          dir: "/tmp/zephyr-output",
          serverDir: "/tmp/zephyr-output/server",
        },
        commands: {
          preview: "npx wrangler --cwd ./ dev",
          deploy: "npx wrangler --cwd ./ deploy",
        },
      },
      logger: {
        info: vi.fn(),
        success: vi.fn(),
      },
    } as any;

    const config = {
      output: {
        dir: "/tmp/zephyr-output/server",
      },
      plugins: [],
    } as any;

    await hooks["build:before"]?.(nitro);
    await hooks["rollup:before"]?.(nitro, config);
    expect(nitro.options.commands.preview).toBeUndefined();
    expect(nitro.options.commands.deploy).toBeUndefined();

    expect(config.plugins).toHaveLength(1);
    const plugin = config.plugins[0];
    const emitFile = vi.fn();

    await plugin.generateBundle.call({ emitFile });

    expect(emitFile).toHaveBeenCalledWith({
      type: "asset",
      fileName: ".zephyr/nitro-build.json",
      source: expect.stringContaining('"generatedBy": "zephyr-nitro-preset"'),
    });
    expect(emitFile).toHaveBeenCalledWith({
      type: "asset",
      fileName: ".zephyr/nitro-build.json",
      source: expect.stringContaining('"outputDir": "/tmp/zephyr-output/server"'),
    });
    expect(nitro.logger.info).not.toHaveBeenCalled();
    expect(nitro.logger.success).not.toHaveBeenCalled();
  });
});
