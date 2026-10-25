import { promises as fsp } from "node:fs";
import { colors } from "consola/utils";
import { glob } from "tinyglobby";
import { gzipSize } from "gzip-size";
import { dirname, relative, resolve } from "pathe";
import prettyBytes from "pretty-bytes";
import { isTest } from "std-env";
import { runParallel } from "./parallel.ts";

export async function generateFSTree(dir: string, options: { compressedSizes?: boolean } = {}) {
  if (isTest) {
    return;
  }

  const files = await glob("**/*.*", {
    cwd: dir,
    ignore: ["**/*.map"],
    followSymbolicLinks: false,
    dot: true,
  });

  const items: { file: string; path: string; size: number; gzip: number }[] = [];

  await runParallel(
    new Set(files),
    async (file) => {
      const path = resolve(dir, file);
      const src = await fsp.readFile(path);
      const size = src.byteLength;
      // node_modules files are only summed into the total, so their gzip size is not reported
      const gzip =
        options.compressedSizes && !file.includes("node_modules") ? await gzipSize(src) : 0;
      items.push({ file, path, size, gzip });
    },
    { concurrency: 10 }
  );

  items.sort((a, b) => a.path.localeCompare(b.path));

  let totalSize = 0;
  let totalGzip = 0;

  let totalNodeModulesSize = 0;
  let hasNodeModules = false;

  let treeText = "";

  for (const [index, item] of items.entries()) {
    let dir = dirname(item.file);
    if (dir === ".") {
      dir = "";
    }
    const rpath = relative(process.cwd(), item.path);
    const treeChar = index === items.length - 1 ? "└─" : "├─";

    const isNodeModules = item.file.includes("node_modules");

    if (isNodeModules) {
      totalNodeModulesSize += item.size;
      hasNodeModules = true;
      continue;
    }

    treeText += colors.gray(`  ${treeChar} ${rpath} (${prettyBytes(item.size)})`);
    if (options.compressedSizes) {
      treeText += colors.gray(` (${prettyBytes(item.gzip)} gzip)`);
    }
    treeText += "\n";
    totalSize += item.size;
    totalGzip += item.gzip;
  }

  treeText += `${colors.cyan("Σ Total size:")} ${prettyBytes(totalSize + totalNodeModulesSize)}`;
  if (options.compressedSizes) {
    treeText += ` (${prettyBytes(totalGzip)} gzip${hasNodeModules ? ", excluding node_modules" : ""})`;
  }
  treeText += "\n";

  return treeText;
}
