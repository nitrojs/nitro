import { promises as fsp } from "node:fs";
import { colors } from "consola/utils";
import { globby } from "globby";
import { gzipSize } from "gzip-size";
import { dirname, relative, resolve } from "pathe";
import prettyBytes from "pretty-bytes";
import { isTest } from "std-env";
import { runParallel } from "./parallel";

/**
 * Print a size tree for the server output.
 *
 * `chunks/raw/**` (Nitro serverAssets `raw:` embeds) are summarized with cheap `stat`
 * calls instead of per-file gzip — otherwise thousands of tiny chunks dominate build wall time
 * after Rollup (see nitrojs/nitro#1833).
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
    let itemDir = dirname(item.file);
    if (itemDir === ".") {
      itemDir = "";
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

  // Summarize raw serverAsset chunks without per-file gzip.
  const rawFiles = await globby("chunks/raw/**/*.*", {
    cwd: dir,
    ignore: ["*.map"],
  });
  if (rawFiles.length > 0) {
    let rawSize = 0;
    await runParallel(
      new Set(rawFiles),
      async (file) => {
        const st = await fsp.stat(resolve(dir, file));
        rawSize += st.size;
      },
      { concurrency: 32 }
    );
    totalSize += rawSize;
    treeText += colors.gray(
      `  ├─ chunks/raw/* (${rawFiles.length} files, ${prettyBytes(rawSize)} — gzip skipped)\n`
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
