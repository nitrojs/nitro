import { fileURLToPath } from "node:url";
import { join } from "pathe";
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import zlib from "node:zlib";
import { beforeAll, describe, expect, it } from "vitest";
import { build, createNitro, prepare } from "nitro/builder";

// #4428: modules need a point to emit files into the public output dir that is late
// enough to be after `copyPublicAssets()` and prerendering, but still early enough for
// the emitted files to end up in the server bundle's public asset list.
const fixtureDir = fileURLToPath(new URL("./server-entry-fixture", import.meta.url));
const outDir = join(fixtureDir, ".tmp/compile-before-hook");

describe("vite: vite:compile:before hook", () => {
  const calls: string[] = [];
  let serverEntry: string;
  let publicDir: string;

  beforeAll(async () => {
    await rm(outDir, { recursive: true, force: true });
    const nitro = await createNitro({
      rootDir: fixtureDir,
      output: { dir: outDir },
      builder: "vite",
      compressPublicAssets: true,
      hooks: {
        "vite:compile:before": async (nitro) => {
          calls.push("vite:compile:before");
          await writeFile(
            join(nitro.options.output.publicDir, "emitted-by-hook.txt"),
            "emitted".repeat(200),
            "utf8"
          );
        },
        compiled: async (nitro) => {
          calls.push("compiled");
          serverEntry = join(nitro.options.output.serverDir, "index.mjs");
          publicDir = nitro.options.output.publicDir;
          await writeFile(
            join(publicDir, "emitted-by-compiled.txt"),
            "emitted".repeat(200),
            "utf8"
          );
        },
      },
    });
    try {
      await prepare(nitro);
      await build(nitro);
    } finally {
      await nitro.close();
    }
  }, 60_000);

  it("runs before the server bundle is compiled", () => {
    expect(calls).toEqual(["vite:compile:before", "compiled"]);
  });

  it("assets emitted from the hook are picked up as public assets", async () => {
    expect(await readFile(serverEntry, "utf8")).toContain("emitted-by-hook.txt");
  });

  it("compresses assets emitted from the hook", () => {
    expect(existsSync(join(publicDir, "emitted-by-hook.txt.gz"))).toBe(true);
    expect(existsSync(join(publicDir, "emitted-by-hook.txt.br"))).toBe(true);
    if (zlib.zstdCompress !== undefined) {
      expect(existsSync(join(publicDir, "emitted-by-hook.txt.zst"))).toBe(true);
    }
  });

  it("compressed siblings are picked up as public assets", async () => {
    expect(await readFile(serverEntry, "utf8")).toContain("emitted-by-hook.txt.gz");
  });

  it("compresses assets emitted by the compiled hook", () => {
    expect(existsSync(join(publicDir, "emitted-by-compiled.txt.gz"))).toBe(true);
  });
});
