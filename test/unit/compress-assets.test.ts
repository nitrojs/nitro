import { existsSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import zlib from "node:zlib";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createNitro } from "../../src/builder.ts";
import type { Nitro, NitroConfig } from "nitro/types";

describe("compressPublicAssets", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await realpath(await mkdtemp(join(tmpdir(), "nitro-compress-")));
    await writeFile(join(rootDir, "package.json"), JSON.stringify({ type: "module" }));
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  async function createProject(config: NitroConfig = {}) {
    const nitro = await createNitro({
      rootDir,
      preset: "node-server",
      compatibilityDate: "2025-01-01",
      logLevel: 0,
      compressPublicAssets: true,
      ...config,
    });
    await mkdir(nitro.options.output.publicDir, { recursive: true });
    return nitro;
  }

  function writeOnClose(nitro: Nitro) {
    nitro.hooks.hook("close", () =>
      writeFile(join(nitro.options.output.publicDir, "late.txt"), "x".repeat(2048))
    );
  }

  it("compresses public assets written by `close` hooks", async () => {
    const nitro = await createProject();
    writeOnClose(nitro);
    await nitro.close();
    const publicDir = nitro.options.output.publicDir;
    expect(existsSync(join(publicDir, "late.txt.gz"))).toBe(true);
    expect(existsSync(join(publicDir, "late.txt.br"))).toBe(true);
    if (zlib.zstdCompress !== undefined) {
      expect(existsSync(join(publicDir, "late.txt.zst"))).toBe(true);
    }
  });

  it("does not compress when `compressPublicAssets` is disabled", async () => {
    const nitro = await createProject({ compressPublicAssets: false });
    writeOnClose(nitro);
    await nitro.close();
    expect(existsSync(join(nitro.options.output.publicDir, "late.txt.gz"))).toBe(false);
  });

  it("does not compress in dev mode", async () => {
    const nitro = await createProject({ dev: true });
    writeOnClose(nitro);
    await nitro.close();
    expect(existsSync(join(nitro.options.output.publicDir, "late.txt.gz"))).toBe(false);
  });

  it("close succeeds without a public directory", async () => {
    const nitro = await createNitro({
      rootDir,
      preset: "node-server",
      compatibilityDate: "2025-01-01",
      logLevel: 0,
      compressPublicAssets: true,
    });
    await expect(nitro.close()).resolves.toBeUndefined();
  });
});
