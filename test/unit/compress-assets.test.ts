import { existsSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import zlib from "node:zlib";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { build, createNitro, prepare, prerender } from "../../src/builder.ts";
import type { Nitro, NitroConfig } from "nitro/types";

// The vite builder loads `nitro/vite` from `dist/`, so it would not use the sources here
const builders = ["rolldown", "rollup"] as const;

describe("compressPublicAssets", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await realpath(await mkdtemp(join(tmpdir(), "nitro-compress-")));
    await writeFile(join(rootDir, "package.json"), JSON.stringify({ type: "module" }));
    await writeFile(
      join(rootDir, "server.ts"),
      `export default { fetch: () => new Response("ok") };`
    );
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
    nitro.hooks.hook("close", () =>
      writeFile(join(nitro.options.output.publicDir, "late.txt"), "x".repeat(2048))
    );
    return nitro;
  }

  async function buildProject(nitro: Nitro) {
    try {
      await prepare(nitro);
      await mkdir(nitro.options.output.publicDir, { recursive: true });
      await build(nitro);
    } finally {
      await nitro.close();
    }
  }

  for (const builder of builders) {
    it(`compresses public assets written by \`close\` hooks (${builder})`, async () => {
      const nitro = await createProject({ builder });
      await buildProject(nitro);
      const publicDir = nitro.options.output.publicDir;
      expect(existsSync(join(publicDir, "late.txt.gz"))).toBe(true);
      expect(existsSync(join(publicDir, "late.txt.br"))).toBe(true);
      if (zlib.zstdCompress !== undefined) {
        expect(existsSync(join(publicDir, "late.txt.zst"))).toBe(true);
      }
    });
  }

  it("does not compress when `compressPublicAssets` is disabled", async () => {
    const nitro = await createProject({ builder: "rolldown", compressPublicAssets: false });
    await buildProject(nitro);
    expect(existsSync(join(nitro.options.output.publicDir, "late.txt.gz"))).toBe(false);
  });

  it("does not compress when closing without a build", async () => {
    const nitro = await createProject();
    await mkdir(nitro.options.output.publicDir, { recursive: true });
    await nitro.close();
    expect(existsSync(join(nitro.options.output.publicDir, "late.txt"))).toBe(true);
    expect(existsSync(join(nitro.options.output.publicDir, "late.txt.gz"))).toBe(false);
  });

  it("does not compress from the prerenderer", async () => {
    let compressedDuringPrerender: boolean | undefined;
    const nitro = await createProject({
      builder: "rolldown",
      prerender: { routes: ["/"] },
      hooks: {
        "prerender:init": (prerenderer) =>
          writeFile(join(prerenderer.options.output.publicDir, "early.txt"), "x".repeat(2048)),
        "prerender:done": () => {
          compressedDuringPrerender = existsSync(
            join(nitro.options.output.publicDir, "early.txt.gz")
          );
        },
      },
    });
    try {
      await prepare(nitro);
      await mkdir(nitro.options.output.publicDir, { recursive: true });
      await prerender(nitro);
    } finally {
      await nitro.close();
    }
    expect(compressedDuringPrerender).toBe(false);
    expect(existsSync(join(nitro.options.output.publicDir, "early.txt.gz"))).toBe(true);
  });
});
