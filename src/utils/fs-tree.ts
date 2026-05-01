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

  const files = await glob("**/*.*", { cwd: dir, ignore: ["*.map"] });

  const items: { file: string; path: string; size: number; gzip: number }[] = [];

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
    let dir = dirname(item.file);
    if (dir === ".") {
      dir = "";
    }
    const rpath = relative(process.cwd(), item.path);
    const treeChar = index === items.length - 1 ? "└─" : "├─";

    const isNodeModules = item.file.includes("node_modules");

    if (isNodeModules) {
      totalNodeModulesSize += item.size;
      totalNodeModulesGzip += item.gzip;
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
    treeText += ` (${prettyBytes(totalGzip + totalNodeModulesGzip)} gzip)`;
  }
  treeText += "\n";

  return treeText;
}
