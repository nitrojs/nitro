import { afterEach, describe, expect, it, vi } from "vitest";
import type { Nitro } from "nitro/types";

const installModules = vi.hoisted(() => vi.fn());
vi.mock("../../src/module.ts", () => ({ installModules }));

async function getPlatformaticPreset() {
  const { default: presets } = await import("../../src/presets/platformatic/preset.ts");
  return presets[0];
}

function createNitro(scheduledTasks: Nitro["options"]["scheduledTasks"]) {
  return { options: { scheduledTasks } } as Pick<Nitro, "options">;
}

describe("platformatic preset", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("installs the Platformatic scheduler when schedules are configured", async () => {
    const preset = await getPlatformaticPreset();
    const nitro = createNitro({ "* * * * *": ["db:cleanup"] });

    const buildBefore = preset.hooks?.["build:before"];
    expect(buildBefore).toBeTypeOf("function");
    await buildBefore!(nitro as Nitro);

    expect(installModules).toHaveBeenCalledWith(nitro, ["@platformatic/nitro/scheduler"]);
  });

  it("does not install the scheduler without schedules", async () => {
    const preset = await getPlatformaticPreset();
    const nitro = createNitro({});

    const buildBefore = preset.hooks?.["build:before"];
    expect(buildBefore).toBeTypeOf("function");
    await buildBefore!(nitro as Nitro);

    expect(installModules).not.toHaveBeenCalled();
  });
});
