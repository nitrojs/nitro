import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Nitro } from "nitropack/types";
import { enableNodeCompat } from "../../src/presets/cloudflare/utils";

function createNitroStub(options: {
  rootDir: string;
  deployConfig?: boolean;
  nodeCompat?: boolean;
  compatibilityDate?: string;
}) {
  return {
    options: {
      rootDir: options.rootDir,
      workspaceDir: options.rootDir,
      unenv: [],
      rollupConfig: { plugins: [] },
      compatibilityDate: {
        cloudflare: options.compatibilityDate,
        default: options.compatibilityDate,
      },
      cloudflare: {
        deployConfig: options.deployConfig,
        nodeCompat: options.nodeCompat,
      },
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
    },
  } as unknown as Nitro;
}

describe("enableNodeCompat", () => {
  let tempDirs: string[] = [];

  beforeEach(() => {
    tempDirs = [];
  });

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("detects implicit nodejs_compat when deployConfig is false and compatibility_date >= 2026-08-04", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "nitro-cf-test-"));
    tempDirs.push(rootDir);

    writeFileSync(
      join(rootDir, "wrangler.json"),
      JSON.stringify({ compatibility_date: "2026-09-13" })
    );

    const nitro = createNitroStub({
      rootDir,
      deployConfig: false,
    });

    await enableNodeCompat(nitro);

    expect(nitro.options.cloudflare?.nodeCompat).toBe(true);
    expect(nitro.options.unenv.length).toBeGreaterThan(0);
    expect(nitro.logger.warn).not.toHaveBeenCalledWith(
      "[cloudflare] Node.js compatibility is not enabled."
    );
  });

  it("detects implicit nodejs_compat from nitro.options.compatibilityDate when deployConfig is false", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "nitro-cf-test-"));
    tempDirs.push(rootDir);

    const nitro = createNitroStub({
      rootDir,
      deployConfig: false,
      compatibilityDate: "2026-08-04",
    });

    await enableNodeCompat(nitro);

    expect(nitro.options.cloudflare?.nodeCompat).toBe(true);
    expect(nitro.options.unenv.length).toBeGreaterThan(0);
  });

  it("does not enable nodejs_compat when compatibility_date is before 2026-08-04 and no flag is present", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "nitro-cf-test-"));
    tempDirs.push(rootDir);

    writeFileSync(
      join(rootDir, "wrangler.json"),
      JSON.stringify({ compatibility_date: "2024-01-01" })
    );

    const nitro = createNitroStub({
      rootDir,
      deployConfig: false,
    });

    await enableNodeCompat(nitro);

    expect(nitro.options.cloudflare?.nodeCompat).toBeFalsy();
    expect(nitro.logger.warn).toHaveBeenCalledWith(
      "[cloudflare] Node.js compatibility is not enabled."
    );
  });

  it("respects explicit no_nodejs_compat flag even if compatibility_date >= 2026-08-04", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "nitro-cf-test-"));
    tempDirs.push(rootDir);

    writeFileSync(
      join(rootDir, "wrangler.json"),
      JSON.stringify({
        compatibility_date: "2026-09-13",
        compatibility_flags: ["no_nodejs_compat"],
      })
    );

    const nitro = createNitroStub({
      rootDir,
      deployConfig: false,
    });

    await enableNodeCompat(nitro);

    expect(nitro.options.cloudflare?.nodeCompat).toBeFalsy();
    expect(nitro.logger.warn).toHaveBeenCalledWith(
      "[cloudflare] Node.js compatibility is not enabled."
    );
  });

  it("enables nodeCompat when explicit nodejs_compat flag is set on older date", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "nitro-cf-test-"));
    tempDirs.push(rootDir);

    writeFileSync(
      join(rootDir, "wrangler.json"),
      JSON.stringify({
        compatibility_date: "2024-01-01",
        compatibility_flags: ["nodejs_compat"],
      })
    );

    const nitro = createNitroStub({
      rootDir,
      deployConfig: false,
    });

    await enableNodeCompat(nitro);

    expect(nitro.options.cloudflare?.nodeCompat).toBe(true);
  });

  it("keeps implicit nodejs_compat with no_nodejs_compat_v2 flag", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "nitro-cf-test-"));
    tempDirs.push(rootDir);

    writeFileSync(
      join(rootDir, "wrangler.json"),
      JSON.stringify({
        compatibility_date: "2026-09-13",
        compatibility_flags: ["no_nodejs_compat_v2"],
      })
    );

    const nitro = createNitroStub({
      rootDir,
      deployConfig: false,
    });

    await enableNodeCompat(nitro);

    expect(nitro.options.cloudflare?.nodeCompat).toBe(true);
  });

  it("detects implicit nodejs_compat when using wrangler.toml", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "nitro-cf-test-"));
    tempDirs.push(rootDir);

    writeFileSync(
      join(rootDir, "wrangler.toml"),
      'compatibility_date = "2026-09-13"\n'
    );

    const nitro = createNitroStub({
      rootDir,
      deployConfig: false,
    });

    await enableNodeCompat(nitro);

    expect(nitro.options.cloudflare?.nodeCompat).toBe(true);
  });

  it("enables nodeCompat when deployConfig is true", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "nitro-cf-test-"));
    tempDirs.push(rootDir);

    const nitro = createNitroStub({
      rootDir,
      deployConfig: true,
    });

    await enableNodeCompat(nitro);

    expect(nitro.options.cloudflare?.nodeCompat).toBe(true);
  });
});
