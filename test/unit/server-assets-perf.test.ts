import { mkdirSync, rmSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "pathe";
import { describe, expect, it } from "vitest";
import { createNitro, build, prepare, copyPublicAssets } from "nitropack/core";

const ROOT = join(import.meta.dirname, ".tmp-server-assets-perf");
const DATA = join(ROOT, "i18n-data");

function genTree(dir: string, depth: number, branch: number): number {
  mkdirSync(dir, { recursive: true });
  if (depth === 0) {
    writeFileSync(
      join(dir, "data.json"),
      JSON.stringify({ v: 1, s: "x".repeat(200) })
    );
    return 1;
  }
  let n = 0;
  for (let i = 0; i < branch; i++) {
    n += genTree(join(dir, `l${i}`), depth - 1, branch);
  }
  return n;
}

function countRawMjs(outDir: string): number {
  const rawDir = join(outDir, "server/chunks/raw");
  if (!existsSync(rawDir)) return 0;
  let n = 0;
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(d, e.name));
      else if (e.name.endsWith(".mjs")) n++;
    }
  };
  walk(rawDir);
  return n;
}

describe("serverAssets large catalogs", () => {
  // depth=4, branch=5 → 625 JSON files
  const fileCount = (() => {
    rmSync(ROOT, { recursive: true, force: true });
    return genTree(DATA, 4, 5);
  })();

  it("generates hundreds of fixture files", () => {
    expect(fileCount).toBe(625);
  });

  it(
    "auto-inlines many small JSON files (no raw: chunk explosion)",
    { timeout: 120_000 },
    async () => {
      const outDir = join(ROOT, "out-auto-inline");
      rmSync(outDir, { recursive: true, force: true });

      const t0 = performance.now();
      const nitro = await createNitro({
        rootDir: ROOT,
        srcDir: ROOT,
        output: { dir: outDir },
        preset: "node-server",
        minify: false,
        typescript: { generateTsConfig: false },
        logging: { compressedSizes: false },
        serverAssets: [{ baseName: "i18n", dir: DATA }],
      });
      await prepare(nitro);
      await copyPublicAssets(nitro);
      await build(nitro);
      const ms = performance.now() - t0;

      // Default embed:true with ≥50 text files → inline → no per-file raw chunks
      expect(countRawMjs(outDir)).toBe(0);
      // Should stay in the same ballpark as nitropack 2.12 on this fixture (was multi‑10s with raw:)
      expect(ms).toBeLessThan(15_000);
    }
  );

  it(
    "embed:false copies assets and skips raw: chunks",
    { timeout: 120_000 },
    async () => {
      const outDir = join(ROOT, "out-fs");
      rmSync(outDir, { recursive: true, force: true });

      const nitro = await createNitro({
        rootDir: ROOT,
        srcDir: ROOT,
        output: { dir: outDir },
        preset: "node-server",
        minify: false,
        typescript: { generateTsConfig: false },
        logging: { compressedSizes: false },
        serverAssets: [{ baseName: "i18n", dir: DATA, embed: false }],
      });
      await prepare(nitro);
      await copyPublicAssets(nitro);
      await build(nitro);

      expect(countRawMjs(outDir)).toBe(0);
      expect(existsSync(join(outDir, "server/assets/i18n"))).toBe(true);
      expect(existsSync(join(outDir, "server/index.mjs"))).toBe(true);
      // Spot-check a copied leaf
      expect(
        existsSync(join(outDir, "server/assets/i18n/l0/l0/l0/l0/data.json"))
      ).toBe(true);
    }
  );

  it(
    "embed:'inline' keeps a single virtual module",
    { timeout: 120_000 },
    async () => {
      const outDir = join(ROOT, "out-inline");
      rmSync(outDir, { recursive: true, force: true });

      const t0 = performance.now();
      const nitro = await createNitro({
        rootDir: ROOT,
        srcDir: ROOT,
        output: { dir: outDir },
        preset: "node-server",
        minify: false,
        typescript: { generateTsConfig: false },
        logging: { compressedSizes: false },
        serverAssets: [{ baseName: "i18n", dir: DATA, embed: "inline" }],
      });
      await prepare(nitro);
      await copyPublicAssets(nitro);
      await build(nitro);
      const ms = performance.now() - t0;

      expect(countRawMjs(outDir)).toBe(0);
      expect(ms).toBeLessThan(15_000);
    }
  );
});
