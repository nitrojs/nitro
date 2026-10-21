import { describe, expect, it, vi } from "vitest";

vi.mock("#nitro/meta", () => ({
  version: "0.0.0-test",
  runtimeDir: "/tmp",
  presetsDir: "/tmp",
  pkgDir: "/tmp",
  runtimeDependencies: [],
}));

vi.mock("std-env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("std-env")>()),
  provider: "deno-deploy",
  runtime: "node",
}));

describe("resolvePreset on Deno Deploy", () => {
  it("auto-detects the deno-server preset", async () => {
    const { resolvePreset } = await import("../../src/presets/_resolve.ts");
    const preset = await resolvePreset("", { compatibilityDate: "latest" });
    expect(preset?._meta?.name).toBe("deno-server");
  });
});
