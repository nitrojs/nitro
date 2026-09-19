import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { readFile, rm, mkdir } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { createNitro, build, prepare } from "nitro/builder";

const fixtureDir = fileURLToPath(new URL("./deno-specifiers-fixture", import.meta.url));
const tmpDir = join(fixtureDir, ".tmp");

// Entry file names differ per preset.
const presets = {
  "bunny-edge-scripting": "bunny-edge-scripting.mjs",
  "deno-server": "server/index.mjs",
  "deno-deploy": "server/index.ts",
};

// The vite builder treats an unresolved import as a build error, so a preset
// that does not externalize `npm:`/`jsr:` fails here rather than silently
// emitting them (which is what the rollup and rolldown builders do).
describe.each(Object.entries(presets))("deno specifiers (%s)", (preset, entryFile) => {
  const outDir = join(tmpDir, preset);
  let entry: string;

  beforeAll(async () => {
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });
    const nitro = await createNitro({
      rootDir: fixtureDir,
      preset,
      output: { dir: outDir },
      builder: "vite",
    });
    try {
      await prepare(nitro);
      await build(nitro);
    } finally {
      await nitro.close();
    }
    entry = await readFile(join(outDir, entryFile), "utf8");
  }, 60_000);

  it("keeps pinned `npm:` specifiers external", () => {
    expect(entry).toContain("npm:lodash-es@4.17.21");
  });

  it("keeps pinned `jsr:` specifiers external", () => {
    expect(entry).toContain("jsr:@std/encoding@1/hex");
  });
});
