import { existsSync, promises as fsp } from "node:fs";
import { glob } from "tinyglobby";
import { isDirectory, prettyPath } from "../utils/fs.ts";
import type { Nitro } from "nitro/types";
import { join, relative, resolve } from "pathe";
import { compressPublicAssets } from "../utils/compress.ts";

const NEGATION_RE = /^(!?)(.*)$/;
const PARENT_DIR_GLOB_RE = /!?\.\.\//;

export async function scanUnprefixedPublicAssets(nitro: Nitro) {
  const scannedPaths: string[] = [];
  for (const asset of nitro.options.publicAssets) {
    if (asset.baseURL && asset.baseURL !== "/" && !asset.fallthrough) {
      // we can statically detect these without scanning
      continue;
    }
    if (!(await isDirectory(asset.dir))) {
      continue;
    }
    const includePatterns = getIncludePatterns(nitro, asset.dir, asset.ignore);
    const publicAssets = await glob(includePatterns, {
      cwd: asset.dir,
      absolute: false,
      dot: true,
    });
    scannedPaths.push(...publicAssets.map((file) => join(asset.baseURL || "/", file)));
  }
  return scannedPaths;
}

export async function copyPublicAssets(nitro: Nitro) {
  if (nitro.options.noPublicDir) {
    return;
  }
  for (const asset of nitro.options.publicAssets) {
    const assetDir = asset.dir;
    const dstDir = join(nitro.options.output.publicDir, asset.baseURL!);
    if (await isDirectory(assetDir)) {
      const includePatterns = getIncludePatterns(nitro, assetDir, asset.ignore);
      const publicAssets = await glob(includePatterns, {
        cwd: assetDir,
        absolute: false,
        dot: true,
      });
      await Promise.all(
        publicAssets.map(async (file) => {
          const src = join(assetDir, file);
          const dst = join(dstDir, file);
          if (!existsSync(dst)) {
            await fsp.cp(src, dst);
          }
        })
      );
    }
  }
  if (nitro.options.compressPublicAssets) {
    await compressPublicAssets(nitro);
  }
  nitro.logger.success("Generated public " + prettyPath(nitro.options.output.publicDir));
}

function getIncludePatterns(
  nitro: Nitro,
  assetDir: string,
  ignorePatterns: string[] | false = nitro.options.ignore
) {
  return [
    "**",
    ...(ignorePatterns || []).map((p) => {
      const [_, negation, pattern] = p.match(NEGATION_RE) || [];
      return (
        // Convert ignore to include patterns
        (negation ? "" : "!") +
        // Make non-glob patterns relative to publicAssetDir
        (pattern.startsWith("*")
          ? pattern
          : relative(assetDir, resolve(nitro.options.rootDir, pattern)))
      );
    }),
  ].filter((p) => !PARENT_DIR_GLOB_RE.test(p));
}
