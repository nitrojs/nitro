import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Nitro } from "nitropack/types";
import { prepare } from "../../src/core/build/prepare";

const temporaryDirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryDirs
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

async function createRoot() {
  const root = await mkdtemp(join(tmpdir(), "nitro-prepare-"));
  temporaryDirs.push(root);
  return root;
}

function createNitro(opts: {
  output: { dir: string; publicDir: string; serverDir: string };
  publicAssets: string[];
}) {
  const warn = vi.fn();
  const nitro = {
    options: {
      output: opts.output,
      publicAssets: opts.publicAssets.map((dir) => ({ dir })),
      noPublicDir: false,
      static: false,
    },
    logger: { warn },
  } as unknown as Nitro;
  return { nitro, warn };
}

describe("prepare", () => {
  it("keeps a public asset source inside the output directory and warns", async () => {
    const root = await createRoot();
    const outputDir = join(root, "dist");
    const sourceDir = join(outputDir, "client");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(sourceDir, "app.js"), "important client asset");
    await mkdir(join(outputDir, "server"), { recursive: true });
    await writeFile(join(outputDir, "server", "stale.js"), "stale server");
    await writeFile(join(outputDir, "index.html"), "stale copy");
    const { nitro, warn } = createNitro({
      output: {
        dir: outputDir,
        publicDir: outputDir,
        serverDir: join(outputDir, "server"),
      },
      publicAssets: [sourceDir],
    });

    await prepare(nitro);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/client.*inside output.*dist/);
    expect(await readFile(join(sourceDir, "app.js"), "utf8")).toBe(
      "important client asset"
    );
    // Everything else is still cleaned
    await expect(
      readFile(join(outputDir, "index.html"), "utf8")
    ).rejects.toThrow();
    await expect(
      readFile(join(outputDir, "server", "stale.js"), "utf8")
    ).rejects.toThrow();
  });

  it("keeps assets behind an external symlink pointing into output", async () => {
    const root = await createRoot();
    const outputDir = join(root, "dist");
    const sourceDir = join(outputDir, "client");
    const aliasDir = join(root, "client-assets");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(sourceDir, "app.js"), "important client asset");
    await symlink(sourceDir, aliasDir, "dir");
    const { nitro, warn } = createNitro({
      output: {
        dir: outputDir,
        publicDir: join(outputDir, "public"),
        serverDir: join(outputDir, "server"),
      },
      publicAssets: [aliasDir],
    });

    await prepare(nitro);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(await readFile(join(aliasDir, "app.js"), "utf8")).toBe(
      "important client asset"
    );
  });

  it("keeps a symlink inside output pointing to assets outside it", async () => {
    const root = await createRoot();
    const outputDir = join(root, "dist");
    const assetsDir = join(root, "assets");
    const linkDir = join(outputDir, "client");
    await mkdir(outputDir, { recursive: true });
    await mkdir(assetsDir, { recursive: true });
    await writeFile(join(assetsDir, "app.js"), "important client asset");
    await symlink(assetsDir, linkDir, "dir");
    const { nitro, warn } = createNitro({
      output: {
        dir: outputDir,
        publicDir: join(outputDir, "public"),
        serverDir: join(outputDir, "server"),
      },
      publicAssets: [linkDir],
    });

    await prepare(nitro);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(await readFile(join(linkDir, "app.js"), "utf8")).toBe(
      "important client asset"
    );
  });

  it("cleans output when the public asset source is outside it", async () => {
    const root = await createRoot();
    const outputDir = join(root, "dist");
    const sourceDir = join(root, "public");
    await mkdir(outputDir, { recursive: true });
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(outputDir, "stale.js"), "stale output");
    await writeFile(join(sourceDir, "app.js"), "important client asset");
    const { nitro, warn } = createNitro({
      output: {
        dir: outputDir,
        publicDir: join(outputDir, "public"),
        serverDir: join(outputDir, "server"),
      },
      publicAssets: [sourceDir],
    });

    await prepare(nitro);

    expect(warn).not.toHaveBeenCalled();
    await expect(
      readFile(join(outputDir, "stale.js"), "utf8")
    ).rejects.toThrow();
    expect(await readFile(join(sourceDir, "app.js"), "utf8")).toBe(
      "important client asset"
    );
  });

  it("only skips the output directory that contains the asset source", async () => {
    const root = await createRoot();
    const outputDir = join(root, "dist");
    const sourceDir = join(root, "other", "client");
    await mkdir(outputDir, { recursive: true });
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(outputDir, "stale.js"), "stale output");
    await writeFile(join(sourceDir, "app.js"), "important client asset");
    const { nitro, warn } = createNitro({
      output: {
        dir: outputDir,
        publicDir: join(root, "other"),
        serverDir: join(outputDir, "server"),
      },
      publicAssets: [sourceDir],
    });

    await prepare(nitro);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/other/);
    await expect(
      readFile(join(outputDir, "stale.js"), "utf8")
    ).rejects.toThrow();
    expect(await readFile(join(sourceDir, "app.js"), "utf8")).toBe(
      "important client asset"
    );
  });

  it("warns once for an asset inside nested output directories", async () => {
    const root = await createRoot();
    const outputDir = join(root, ".output");
    const sourceDir = join(outputDir, "public", "foo");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(sourceDir, "app.js"), "important client asset");
    await writeFile(join(outputDir, "public", "stale.js"), "stale output");
    const { nitro, warn } = createNitro({
      output: {
        dir: outputDir,
        publicDir: join(outputDir, "public"),
        serverDir: join(outputDir, "server"),
      },
      publicAssets: [sourceDir],
    });

    await prepare(nitro);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(await readFile(join(sourceDir, "app.js"), "utf8")).toBe(
      "important client asset"
    );
    await expect(
      readFile(join(outputDir, "public", "stale.js"), "utf8")
    ).rejects.toThrow();
  });

  it("cleans a symlinked output directory as before", async () => {
    const root = await createRoot();
    const targetDir = join(root, "target");
    const outputDir = join(root, "dist");
    const sourceDir = join(targetDir, "client");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(sourceDir, "app.js"), "important client asset");
    await symlink(targetDir, outputDir, "dir");
    const { nitro, warn } = createNitro({
      output: {
        dir: outputDir,
        publicDir: join(outputDir, "public"),
        serverDir: join(outputDir, "server"),
      },
      publicAssets: [sourceDir],
    });

    await prepare(nitro);

    // Only the link is replaced, the asset in the link target is untouched
    expect(warn).not.toHaveBeenCalled();
    expect(await readFile(join(sourceDir, "app.js"), "utf8")).toBe(
      "important client asset"
    );
  });

  it("does not clean the target of a symlinked output directory", async () => {
    const root = await createRoot();
    const targetDir = join(root, "target");
    const outputDir = join(root, "out");
    const sourceDir = join(targetDir, "public", "client");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(targetDir, "public", "other.txt"), "keep me");
    await symlink(targetDir, outputDir, "dir");
    const { nitro } = createNitro({
      output: {
        dir: outputDir,
        publicDir: join(outputDir, "public"),
        serverDir: join(outputDir, "server"),
      },
      publicAssets: [sourceDir],
    });

    await prepare(nitro);

    expect(await readFile(join(targetDir, "public", "other.txt"), "utf8")).toBe(
      "keep me"
    );
  });

  it("does not fail on an invalid asset directory", async () => {
    const root = await createRoot();
    const outputDir = join(root, "dist");
    await writeFile(join(root, "file"), "");
    const { nitro, warn } = createNitro({
      output: {
        dir: outputDir,
        publicDir: join(outputDir, "public"),
        serverDir: join(outputDir, "server"),
      },
      publicAssets: [join(root, "file", "sub")],
    });

    await expect(prepare(nitro)).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it("ignores asset directories that do not exist yet", async () => {
    const root = await createRoot();
    const outputDir = join(root, "dist");
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, "stale.js"), "stale output");
    const { nitro, warn } = createNitro({
      output: {
        dir: outputDir,
        publicDir: join(outputDir, "public"),
        serverDir: join(outputDir, "server"),
      },
      publicAssets: [join(outputDir, "client")],
    });

    await prepare(nitro);

    expect(warn).not.toHaveBeenCalled();
    await expect(
      readFile(join(outputDir, "stale.js"), "utf8")
    ).rejects.toThrow();
  });
});
