import type { Nitro, NitroBuildInfo } from "nitro/types";
import { relative, resolve } from "pathe";
import { version as nitroVersion } from "nitro/meta";
import { presetsWithConfig } from "../presets/_types.gen.ts";
import { writeFile } from "../utils/fs.ts";
import { mkdir, unlink, symlink } from "node:fs/promises";
import { dirname } from "node:path";

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
      ...Object.fromEntries(
        presetsWithConfig.map((key) => [key, nitro.options[key]])
      ),
    },
  };

  await writeFile(buildInfoPath, JSON.stringify(buildInfo, null, 2), true);

  const lastBuild = resolve(
    nitro.options.rootDir,
    "node_modules/.nitro/last-build.json"
  );
  await mkdir(dirname(lastBuild), { recursive: true });
  await writeFile(
    lastBuild,
    JSON.stringify({
      outputDir: relative(lastBuild, nitro.options.output.dir),
    })
  );
  return buildInfo;
}
