import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("#nitro/meta", () => ({
  version: "0.0.0-test",
  runtimeDir: "/tmp",
  presetsDir: "/tmp",
  pkgDir: "/tmp",
  runtimeDependencies: [],
}));

// Cloudflare Workers Builds (detected as `cloudflare_module` without a config file)
vi.mock("std-env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("std-env")>()),
  provider: "cloudflare_workers",
  runtime: "node",
}));

async function resolve(name: string, opts: Record<string, unknown> = {}) {
  const { resolvePreset } = await import("../../src/presets/_resolve.ts");
  return resolvePreset(name, { compatibilityDate: "latest", ...opts });
}

describe("preset detection from `cloudflare.config.ts`", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "nitro-preset-detect-"));

  afterAll(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it("takes precedence over the detected provider", async () => {
    expect((await resolve("", { rootDir }))?._meta?.name).toBe("cloudflare-module");
    writeFileSync(join(rootDir, "cloudflare.config.ts"), "export default {};");
    expect((await resolve("", { rootDir }))?._meta?.name).toBe("cloudflare");
    expect((await resolve("cloudflare_module", { rootDir }))?._meta?.name).toBe(
      "cloudflare-module"
    );
  });
});
