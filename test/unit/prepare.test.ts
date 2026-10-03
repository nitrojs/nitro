import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, describe, expect, it } from "vitest";
import { prepare } from "../../src/build/prepare.ts";
import type { Nitro } from "nitro/types";

const temporaryDirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("prepare", () => {
  it("does not delete a public asset source inside the output directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "nitro-prepare-"));
    temporaryDirs.push(root);
    const outputDir = join(root, "dist");
    const sourceDir = join(outputDir, "client");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(sourceDir, "app.js"), "important client asset");
    const nitro = {
      options: {
        output: {
          dir: outputDir,
          publicDir: join(outputDir, "public"),
          serverDir: join(outputDir, "server"),
        },
        publicAssets: [{ dir: sourceDir }],
        noPublicDir: false,
        static: false,
      },
    } as Nitro;

    await expect(prepare(nitro)).rejects.toThrow(/publicAssets.*dist/);
    expect(await readFile(join(sourceDir, "app.js"), "utf8")).toBe("important client asset");
  });

  it("rejects an external symlink pointing to assets inside output", async () => {
    const root = await mkdtemp(join(tmpdir(), "nitro-prepare-"));
    temporaryDirs.push(root);
    const outputDir = join(root, "dist");
    const sourceDir = join(outputDir, "client");
    const aliasDir = join(root, "client-assets");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(sourceDir, "app.js"), "important client asset");
    await symlink(sourceDir, aliasDir, "dir");
    const nitro = {
      options: {
        output: {
          dir: outputDir,
          publicDir: join(outputDir, "public"),
          serverDir: join(outputDir, "server"),
        },
        publicAssets: [{ dir: aliasDir }],
        noPublicDir: false,
        static: false,
      },
    } as Nitro;

    await expect(prepare(nitro)).rejects.toThrow(/dist.*publicAssets/);
    expect(await readFile(join(aliasDir, "app.js"), "utf8")).toBe("important client asset");
  });

  it("rejects a symlink inside output pointing to assets outside it", async () => {
    const root = await mkdtemp(join(tmpdir(), "nitro-prepare-"));
    temporaryDirs.push(root);
    const outputDir = join(root, "dist");
    const assetsDir = join(root, "assets");
    const linkDir = join(outputDir, "client");
    await mkdir(outputDir, { recursive: true });
    await mkdir(assetsDir, { recursive: true });
    await writeFile(join(assetsDir, "app.js"), "important client asset");
    await symlink(assetsDir, linkDir, "dir");
    const nitro = {
      options: {
        output: {
          dir: outputDir,
          publicDir: join(outputDir, "public"),
          serverDir: join(outputDir, "server"),
        },
        publicAssets: [{ dir: linkDir }],
        noPublicDir: false,
        static: false,
      },
    } as Nitro;

    await expect(prepare(nitro)).rejects.toThrow(/dist.*publicAssets/);
    expect(await readFile(join(linkDir, "app.js"), "utf8")).toBe("important client asset");
  });

  it("cleans output when the public asset source is outside it", async () => {
    const root = await mkdtemp(join(tmpdir(), "nitro-prepare-"));
    temporaryDirs.push(root);
    const outputDir = join(root, "dist");
    const sourceDir = join(root, "public");
    await mkdir(outputDir, { recursive: true });
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(outputDir, "stale.js"), "stale output");
    await writeFile(join(sourceDir, "app.js"), "important client asset");
    const nitro = {
      options: {
        output: {
          dir: outputDir,
          publicDir: join(outputDir, "public"),
          serverDir: join(outputDir, "server"),
        },
        publicAssets: [{ dir: sourceDir }],
        noPublicDir: false,
        static: false,
      },
    } as Nitro;

    await prepare(nitro);
    await expect(readFile(join(outputDir, "stale.js"), "utf8")).rejects.toThrow();
    expect(await readFile(join(sourceDir, "app.js"), "utf8")).toBe("important client asset");
  });

  it("does not clean another output directory before rejecting an overlapping asset", async () => {
    const root = await mkdtemp(join(tmpdir(), "nitro-prepare-"));
    temporaryDirs.push(root);
    const outputDir = join(root, "dist");
    const sourceDir = join(root, "other", "client");
    await mkdir(outputDir, { recursive: true });
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(outputDir, "stale.js"), "keep until validation succeeds");
    await writeFile(join(sourceDir, "app.js"), "important client asset");
    const nitro = {
      options: {
        output: {
          dir: outputDir,
          publicDir: join(root, "other"),
          serverDir: join(outputDir, "server"),
        },
        publicAssets: [{ dir: sourceDir }],
        noPublicDir: false,
        static: false,
      },
    } as Nitro;

    await expect(prepare(nitro)).rejects.toThrow(/publicAssets.*other/);
    expect(await readFile(join(outputDir, "stale.js"), "utf8")).toBe(
      "keep until validation succeeds"
    );
    expect(await readFile(join(sourceDir, "app.js"), "utf8")).toBe("important client asset");
  });

  it("allows an output asset directory that has not been generated yet", async () => {
    const root = await mkdtemp(join(tmpdir(), "nitro-prepare-"));
    temporaryDirs.push(root);
    const outputDir = join(root, "dist");
    const nitro = {
      options: {
        output: {
          dir: outputDir,
          publicDir: join(outputDir, "public"),
          serverDir: join(outputDir, "server"),
        },
        publicAssets: [{ dir: join(outputDir, "client") }],
        noPublicDir: false,
        static: false,
      },
    } as Nitro;

    await expect(prepare(nitro)).resolves.toBeUndefined();
  });

  it("cleans a generated asset directory left by a previous build", async () => {
    const root = await mkdtemp(join(tmpdir(), "nitro-prepare-"));
    temporaryDirs.push(root);
    const outputDir = join(root, "dist");
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, "stale.js"), "stale output");
    const nitro = {
      options: {
        output: {
          dir: outputDir,
          publicDir: outputDir,
          serverDir: join(outputDir, "server"),
        },
        publicAssets: [{ dir: outputDir }],
        noPublicDir: false,
        static: false,
      },
    } as Nitro;

    await prepare(nitro, { generatedAssetDirs: [outputDir] });
    await expect(readFile(join(outputDir, "stale.js"), "utf8")).rejects.toThrow();
  });
});
