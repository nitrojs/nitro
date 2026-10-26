import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { describe, expect, it, vi } from "vitest";

vi.mock("#nitro/meta", () => ({
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

  it("detects the cloudflare preset from `cloudflare.config.ts`", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "nitro-preset-detect-"));
    try {
      expect((await resolve("", { rootDir }))?._meta?.name).toBe("node-server");
      writeFileSync(join(rootDir, "cloudflare.config.ts"), "export default {};");
      expect((await resolve("", { rootDir }))?._meta?.name).toBe("cloudflare");
      expect((await resolve("", { rootDir, defaultPreset: "bun" }))?._meta?.name).toBe(
        "cloudflare"
      );
      expect((await resolve("bun", { rootDir }))?._meta?.name).toBe("bun");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("resolves the legacy platform_sh name to the upsun preset", async () => {
    for (const name of ["platform-sh", "platform_sh", "platformSh"]) {
      const preset = await resolve(name);
      expect(preset?._meta?.name).toBe("upsun");
    }
  });
});
