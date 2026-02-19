import { describe, expect, it, vi } from "vitest";
import zephyrPresets from "../../src/presets/zephyr/preset.ts";

describe("zephyr preset", () => {
  it("extends base-worker", () => {
    const [preset] = zephyrPresets;
    expect(preset.extends).toBe("base-worker");
    expect(preset.output?.publicDir).toBe("{{ output.dir }}/client/{{ baseURL }}");
  });

  it("adds cloudflare unenv presets", async () => {
    const [preset] = zephyrPresets;
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
});
