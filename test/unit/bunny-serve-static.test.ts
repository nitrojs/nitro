import { describe, expect, it, vi } from "vitest";
import type { Nitro } from "nitro/types";
import bunnyPresets from "../../src/presets/bunny/preset.ts";

const [edgeScripting] = bunnyPresets;

function runBuildBefore(serveStatic: unknown) {
  const nitro = {
    options: { serveStatic },
    logger: { warn: vi.fn() },
  };
  edgeScripting.hooks["build:before"](nitro as unknown as Nitro);
  return nitro;
}

describe("bunny preset `serveStatic`", () => {
  it("keeps `inline`", () => {
    const nitro = runBuildBefore("inline");
    expect(nitro.options.serveStatic).toBe("inline");
    expect(nitro.logger.warn).not.toHaveBeenCalled();
  });

  it("keeps `false` as the escape hatch for the script size limit", () => {
    const nitro = runBuildBefore(false);
    expect(nitro.options.serveStatic).toBe(false);
    expect(nitro.logger.warn).not.toHaveBeenCalled();
  });

  // Edge Scripting serves a single file, so there is no directory to read
  // assets from at runtime.
  it.each([true, "node", "deno"])("overrides %o to `inline` and warns", (serveStatic) => {
    const nitro = runBuildBefore(serveStatic);
    expect(nitro.options.serveStatic).toBe("inline");
    expect(nitro.logger.warn).toHaveBeenCalledOnce();
  });
});
