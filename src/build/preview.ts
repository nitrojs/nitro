import type { NitroBuildInfo } from "nitro/types";

import { readFile, stat } from "node:fs/promises";
import { resolve } from "pathe";

export async function loadLastBuild(
  root: string
): Promise<
  | { outputDir?: undefined; buildInfo?: undefined }
  | { outputDir: string; buildInfo?: NitroBuildInfo }
> {
  const outputDir = await findLastBuildDir(root);

  const isDir = await stat(outputDir)
    .then((s) => s.isDirectory())
    .catch(() => false);
  if (!isDir) {
    return {};
  }

  const buildInfo = (await readFile(resolve(outputDir, "nitro.json"), "utf8")
    .then(JSON.parse)
    .catch(() => undefined)) as NitroBuildInfo | undefined;

  return {
    outputDir,
    buildInfo,
  };
}

export async function findLastBuildDir(root: string): Promise<string> {
  const lastBuildLink = resolve(root, "node_modules/.nitro/last-build.json");
  const outputDir = await readFile(lastBuildLink, "utf8")
    .then(JSON.parse)
    .then((data) =>
      resolve(lastBuildLink, data.outputDir || "../../../.output")
    )
    .catch(() => resolve(root, ".output"));
  return outputDir;
}
