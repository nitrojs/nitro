import { describe, expect, it, vi } from "vitest";

vi.mock("nitro/meta", () => ({
  version: "0.0.0-test",
  runtimeDir: "/tmp",
  presetsDir: "/tmp",
  pkgDir: "/tmp",
  runtimeDependencies: [],
}));

// Force a "plain" environment: no hosting provider, node runtime
vi.mock("std-env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("std-env")>()),
  provider: "",
  runtime: "node",
}));

async function resolve(name: string, opts: Record<string, unknown> = {}) {
  const { resolvePreset } = await import("../../src/presets/_resolve.ts");
  return resolvePreset(name, { compatibilityDate: "latest", ...opts });
}

describe("defaultPreset", () => {
  it("falls back to node-server without a defaultPreset", async () => {
    const preset = await resolve("");
    expect(preset?._meta?.name).toBe("node-server");
  });

  it("uses a string defaultPreset as the auto-detect fallback", async () => {
    const preset = await resolve("", { defaultPreset: "node-cluster" });
    expect(preset?._meta?.name).toBe("node-cluster");
  });

  it("uses an inline object defaultPreset", async () => {
    const preset = await resolve("", {
      defaultPreset: { entry: "./custom", _meta: { name: "my-default" } },
    });
    expect(preset?._meta?.name).toBe("my-default");
    expect((preset as { entry?: string })?.entry).toBe("./custom");
  });

  it("names an inline object defaultPreset 'default' when no _meta is set", async () => {
    const preset = await resolve("", { defaultPreset: { entry: "./custom" } });
    expect(preset?._meta?.name).toBe("default");
  });

  it("ignores defaultPreset when an explicit preset is given", async () => {
    const preset = await resolve("bun", { defaultPreset: "node-cluster" });
    expect(preset?._meta?.name).toBe("bun");
  });
});
