import { promises as fsp } from "node:fs";
import { colors } from "consola/utils";
import { globby } from "globby";
import { gzipSize } from "gzip-size";
import { dirname, relative, resolve } from "pathe";
import prettyBytes from "pretty-bytes";
import { isTest } from "std-env";
import { runParallel } from "./parallel";

/**
 * Build a printable size tree for the server output directory.
 *
 * Files under `chunks/raw/` (one Rollup module per `serverAssets` file) are
 * summarized with `stat` only. Gzipping each of them dominated build wall time
 * for large catalogs (nitrojs/nitro#1833).
 */
export async function generateFSTree(
  dir: string,
  options: { compressedSizes?: boolean } = {}
) {
  if (isTest) {
    return;
  }

  const files = await globby("**/*.*", {
    cwd: dir,
    ignore: ["*.map", "chunks/raw/**"],
  });

  const items: { file: string; path: string; size: number; gzip: number }[] =
    [];

  await runParallel(
    new Set(files),
    async (file) => {
      const path = resolve(dir, file);
      const src = await fsp.readFile(path);
      const size = src.byteLength;
      const gzip = options.compressedSizes ? await gzipSize(src) : 0;
      items.push({ file, path, size, gzip });
    },
    { concurrency: 10 }
  );

  items.sort((a, b) => a.path.localeCompare(b.path));

  let totalSize = 0;
  let totalGzip = 0;

  let totalNodeModulesSize = 0;
  let totalNodeModulesGzip = 0;

  let treeText = "";

  for (const [index, item] of items.entries()) {
    let _dir = dirname(item.file);
    if (_dir === ".") {
      _dir = "";
    }
    const rpath = relative(process.cwd(), item.path);
    const treeChar = index === items.length - 1 ? "└─" : "├─";

    const isNodeModules = item.file.includes("node_modules");

    if (isNodeModules) {
      totalNodeModulesSize += item.size;
      totalNodeModulesGzip += item.gzip;
      continue;
    }

    treeText += colors.gray(
      `  ${treeChar} ${rpath} (${prettyBytes(item.size)})`
    );
    if (options.compressedSizes) {
      treeText += colors.gray(` (${prettyBytes(item.gzip)} gzip)`);
    }
    treeText += "\n";
    totalSize += item.size;
    totalGzip += item.gzip;
  }

  const rawFiles = await globby("chunks/raw/**/*.*", {
    cwd: dir,
    ignore: ["*.map"],
  });
  if (rawFiles.length > 0) {
    let rawSize = 0;
    await runParallel(
      new Set(rawFiles),
      async (file) => {
        rawSize += (await fsp.stat(resolve(dir, file))).size;
      },
      { concurrency: 25 }
    );
    totalSize += rawSize;
    treeText += colors.gray(
      `  ├─ chunks/raw/* (${rawFiles.length} files, ${prettyBytes(rawSize)}, gzip skipped)\n`
    );
  }

  treeText += `${colors.cyan("Σ Total size:")} ${prettyBytes(
    totalSize + totalNodeModulesSize
  )}`;
  if (options.compressedSizes) {
    treeText += ` (${prettyBytes(totalGzip + totalNodeModulesGzip)} gzip)`;
  }
  treeText += "\n";

  return treeText;
}
