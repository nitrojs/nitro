import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { stripVTControlCharacters } from "node:util";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateFSTree } from "../../src/utils/fs-tree.ts";

// generateFSTree prints nothing under test
vi.mock("std-env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("std-env")>()),
  isTest: false,
}));

const { gzipSize } = vi.hoisted(() => ({
  gzipSize: vi.fn(async (input: Uint8Array) => input.byteLength / 2),
}));
vi.mock("gzip-size", () => ({ gzipSize }));

describe("generateFSTree", () => {
  let dir: string;

  beforeEach(async () => {
    gzipSize.mockClear();
    dir = await realpath(await mkdtemp(join(tmpdir(), "nitro-fs-tree-")));
    await writeFile(join(dir, "index.mjs"), "a".repeat(1000));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function tree() {
    return stripVTControlCharacters((await generateFSTree(dir, { compressedSizes: true })) || "");
  }

  it("reports gzip sizes of the listed files", async () => {
    const text = await tree();

    expect(text).toContain("index.mjs (1 kB) (500 B gzip)");
    expect(text).toContain("Σ Total size: 1 kB (500 B gzip)\n");
  });

  it("skips gzip sizes when the output has node_modules", async () => {
    await mkdir(join(dir, "node_modules/dep"), { recursive: true });
    await writeFile(join(dir, "node_modules/dep/index.js"), "b".repeat(3000));

    const text = await tree();

    expect(gzipSize).not.toHaveBeenCalled();
    expect(text).not.toContain("node_modules/dep");
    expect(text).toContain("index.mjs (1 kB)\n");
    expect(text).toContain("Σ Total size: 4 kB\n");
  });
});
