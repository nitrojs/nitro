import { existsSync, promises as fsp } from "node:fs";
import { globby } from "globby";
import { isDirectory, prettyPath } from "nitropack/kit";
import type { Nitro } from "nitropack/types";
import { join, relative, resolve } from "pathe";
import { compressPublicAssets } from "../utils/compress";

const NEGATION_RE = /^(!?)(.*)$/;
const PARENT_DIR_GLOB_RE = /!?\.\.\//;

export async function getPublicAssets(nitro: Nitro) {
  if (nitro.options.noPublicDir) {
    return;
  }
  const publicAssets: Array<{ file: string; src: string; dst: string }> = [];

  for (const asset of nitro.options.publicAssets) {
    const srcDir = asset.dir;
    const dstDir = join(nitro.options.output.publicDir, asset.baseURL!);
    if (await isDirectory(srcDir)) {
      const includePatterns = [
        "**",
        ...nitro.options.ignore.map((p) => {
          const [_, negation, pattern] = p.match(NEGATION_RE) || [];
          return (
            // Convert ignore to include patterns
            (negation ? "" : "!") +
            // Make non-glob patterns relative to publicAssetDir
            (pattern.startsWith("*")
              ? pattern
              : relative(srcDir, resolve(nitro.options.srcDir, pattern)))
          );
        }),
      ].filter((p) => !PARENT_DIR_GLOB_RE.test(p));

      const files = await globby(includePatterns, {
        cwd: srcDir,
        absolute: false,
        dot: true,
      });

      publicAssets.push(
        ...files.map((file) => ({
          file,
          src: join(srcDir, file),
          dst: join(dstDir, file),
        }))
      );
    }
  }

  return publicAssets;
}

export async function copyPublicAssets(nitro: Nitro) {
  const publicAssets = await getPublicAssets(nitro);
  if (!publicAssets) {
    return;
  }

  await Promise.all(
    publicAssets.map(async (file) => {
      if (!existsSync(file.dst)) {
        await fsp.cp(file.src, file.dst);
      }
    })
  );

  if (nitro.options.compressPublicAssets) {
    await compressPublicAssets(nitro);
  }
  nitro.logger.success(
    "Generated public " + prettyPath(nitro.options.output.publicDir)
  );
}
