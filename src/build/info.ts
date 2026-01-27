import type { Nitro, NitroBuildInfo, WorkerAddress } from "nitro/types";
import { join, relative, resolve } from "pathe";
import { version as nitroVersion } from "nitro/meta";
import { presetsWithConfig } from "../presets/_types.gen.ts";
import { writeFile } from "../utils/fs.ts";
import { mkdir, readFile, stat } from "node:fs/promises";
import { dirname } from "node:path";

const NITRO_WELLKNOWN_DIR = "node_modules/.nitro";

export async function getBuildInfo(
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
  const lastBuildLink = join(root, NITRO_WELLKNOWN_DIR, "last-build.json");
  const outputDir = await readFile(lastBuildLink, "utf8")
    .then(JSON.parse)
    .then((data) => resolve(lastBuildLink, data.outputDir || "../../../.output"))
    .catch(() => resolve(root, ".output"));
  return outputDir;
}

export async function writeBuildInfo(nitro: Nitro): Promise<NitroBuildInfo> {
  const buildInfoPath = resolve(nitro.options.output.dir, "nitro.json");
  const buildInfo: NitroBuildInfo = {
    date: new Date().toJSON(),
    preset: nitro.options.preset,
    framework: nitro.options.framework,
    versions: {
      nitro: nitroVersion,
    },
    commands: {
      preview: nitro.options.commands.preview,
      deploy: nitro.options.commands.deploy,
    },
    config: {
      ...Object.fromEntries(presetsWithConfig.map((key) => [key, nitro.options[key]])),
    },
  };

  await writeFile(buildInfoPath, JSON.stringify(buildInfo, null, 2), true);

  const lastBuild = join(nitro.options.rootDir, NITRO_WELLKNOWN_DIR, "last-build.json");
  await mkdir(dirname(lastBuild), { recursive: true });
  await writeFile(
    lastBuild,
    JSON.stringify({
      outputDir: relative(lastBuild, nitro.options.output.dir),
    })
  );
  return buildInfo;
}

export async function writeDevBuildInfo(nitro: Nitro, addr?: WorkerAddress): Promise<void> {
  const buildInfoPath = join(nitro.options.rootDir, NITRO_WELLKNOWN_DIR, "nitro.dev.json");
  const buildInfo: NitroBuildInfo = {
    date: new Date().toJSON(),
    preset: nitro.options.preset,
    framework: nitro.options.framework,
    versions: {
      nitro: nitroVersion,
    },
    dev: {
      pid: process.pid,
      workerAddress: addr,
    },
  };
  await writeFile(buildInfoPath, JSON.stringify(buildInfo, null, 2));
}
