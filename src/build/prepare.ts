import fsp from "node:fs/promises";
import { isAbsolute, relative, resolve } from "pathe";
import type { Nitro } from "nitro/types";

export async function prepare(nitro: Nitro) {
  const dirsToClean = [
    nitro.options.output.dir,
    ...(!nitro.options.noPublicDir ? [nitro.options.output.publicDir] : []),
    ...(!nitro.options.static ? [nitro.options.output.serverDir] : []),
  ];

  for (const asset of nitro.options.publicAssets) {
    const sourceDir = resolve(asset.dir);
    // Generated asset directories may not exist until after prepare (for example, Vite output).
    try {
      if (!(await fsp.stat(sourceDir)).isDirectory()) {
        continue;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      throw error;
    }
    for (const outputDir of dirsToClean) {
      const pathFromOutput = relative(resolve(outputDir), sourceDir);
      if (
        !pathFromOutput ||
        (!pathFromOutput.startsWith("../") &&
          pathFromOutput !== ".." &&
          !isAbsolute(pathFromOutput))
      ) {
        throw new Error(
          `Cannot prepare output directory ${outputDir}: publicAssets source ${asset.dir} is inside it and would be deleted.`
        );
      }
    }
  }

  for (const dir of dirsToClean) {
    await prepareDir(dir);
  }
}

async function prepareDir(dir: string) {
  await fsp.rm(dir, { recursive: true, force: true });
  await fsp.mkdir(dir, { recursive: true });
}
