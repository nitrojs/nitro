import fsp from "node:fs/promises";
import type { Nitro } from "nitropack";
import { prettyPath } from "nitropack/kit";
import { basename, dirname, isAbsolute, join, relative, resolve } from "pathe";

export async function prepare(nitro: Nitro) {
  const dirsToClean = [
    ...new Set(
      [
        nitro.options.output.dir,
        ...(nitro.options.noPublicDir ? [] : [nitro.options.output.publicDir]),
        ...(nitro.options.static ? [] : [nitro.options.output.serverDir]),
      ].map((dir) => resolve(dir))
    ),
  ];

  // Resolve asset dirs before deleting anything (they are never deleted)
  const assetDirs = await resolvePublicAssetDirs(nitro);
  const warnedAssetDirs = new Set<string>();
  for (const dir of dirsToClean) {
    // Check each dir right before cleaning it, as cleaning a previous
    // (symlinked) output dir can change where it points to.
    // `rm` only removes the link itself if the output dir is a symlink.
    const isLink = await fsp
      .lstat(dir)
      .then((stat) => stat.isSymbolicLink())
      .catch(() => false);
    const actualDir = isLink ? dir : (await realpathOrUndefined(dir)) || dir;
    const insideAssetDirs = isLink
      ? []
      : assetDirs.filter((asset) =>
          asset.paths.some((path) => isInside(actualDir, path))
        );
    for (const asset of insideAssetDirs) {
      if (!warnedAssetDirs.has(asset.dir)) {
        warnedAssetDirs.add(asset.dir);
        nitro.logger.warn(
          `Public assets directory \`${prettyPath(asset.dir)}\` is inside output directory \`${prettyPath(dir)}\` and has been kept while cleaning the output. Move public assets outside of the output directory.`
        );
      }
    }
    if (insideAssetDirs.length > 0) {
      await cleanDirKeeping(
        actualDir,
        insideAssetDirs.flatMap((asset) => asset.paths)
      );
    } else {
      await cleanDir(dir);
    }
    await fsp.mkdir(dir, { recursive: true });
  }
}

function cleanDir(dir: string) {
  return fsp.rm(dir, { recursive: true, force: true });
}

/**
 * Removes everything inside `dir` except the `keep` paths (and their parents).
 */
async function cleanDirKeeping(dir: string, keep: string[]) {
  if (keep.some((path) => isInside(path, dir))) {
    return;
  }
  const entries = await fsp.readdir(dir).catch(() => [] as string[]);
  for (const entry of entries) {
    const path = join(dir, entry);
    await (keep.some((keepPath) => isInside(path, keepPath))
      ? cleanDirKeeping(path, keep)
      : cleanDir(path));
  }
}

async function resolvePublicAssetDirs(nitro: Nitro) {
  const assetDirs: { dir: string; paths: string[] }[] = [];
  for (const asset of nitro.options.publicAssets || []) {
    const sourceDir = resolve(asset.dir);
    const actualSourceDir = await realpathOrUndefined(sourceDir);
    const actualParentDir = await realpathOrUndefined(dirname(sourceDir));
    if (!actualSourceDir || !actualParentDir) {
      continue; // Does not exist (yet), nothing to protect
    }
    // Also keep the link location itself in case the source dir is a symlink
    const sourceLinkDir = join(actualParentDir, basename(sourceDir));
    assetDirs.push({ dir: asset.dir, paths: [sourceLinkDir, actualSourceDir] });
  }
  return assetDirs;
}

function realpathOrUndefined(path: string) {
  return fsp.realpath(path).catch(() => undefined);
}

function isInside(parent: string, child: string) {
  const path = relative(parent, child);
  return (
    !path || (path !== ".." && !path.startsWith("../") && !isAbsolute(path))
  );
}
