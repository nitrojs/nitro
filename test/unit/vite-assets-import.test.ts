import { describe, expect, it, vi } from "vitest";
import { nitroAssetsImport } from "../../src/build/vite/_assets.ts";
import type { NitroPluginContext } from "../../src/build/vite/types.ts";

vi.mock("@hiogawa/vite-plugin-fullstack/assets", () => ({
  default: () => [null, { name: "fullstack:test", transform: () => "export const value = 1" }],
}));

describe("nitroAssetsImport", () => {
  it("ignores falsy plugins returned by the fullstack assets plugin", () => {
    const plugins = nitroAssetsImport({} as NitroPluginContext);
    expect(plugins).toHaveLength(1);
    expect(plugins[0]!.name).toBe("fullstack:test");
  });
});
