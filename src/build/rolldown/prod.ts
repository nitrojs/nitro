import type { Nitro, NitroBuildInfo } from "nitro/types";
import type { OutputOptions, RolldownOptions } from "rolldown";
import { formatCompatibilityDate } from "compatx";
import { writeFile } from "../../utils/fs";
import { version as nitroVersion } from "nitro/meta";
import { relative, resolve } from "pathe";
import { presetsWithConfig } from "../../presets/_types.gen";
import { scanHandlers } from "../../scan";
import { generateFSTree } from "../../utils/fs-tree";
import { nitroServerName } from "../../utils/nitro";
import { writeTypes } from "../types";
import { snapshot } from "../snapshot";

export async function buildProduction(nitro: Nitro, config: RolldownOptions) {
  const rolldown = await import("rolldown");

  await scanHandlers(nitro);
  await writeTypes(nitro);
  await snapshot(nitro);

  if (!nitro.options.static) {
    nitro.logger.info(
      `Building ${nitroServerName(nitro)} (rolldown, preset: \`${nitro.options.preset}\`, compatibility date: \`${formatCompatibilityDate(nitro.options.compatibilityDate)}\`)`
    );
    const build = await rolldown.rolldown(config);
    await build.write(config.output as OutputOptions);
  }

  // Write .output/nitro.json
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
  await writeFile(buildInfoPath, JSON.stringify(buildInfo, null, 2));

  if (!nitro.options.static) {
    if (nitro.options.logging.buildSuccess) {
      nitro.logger.success(`${nitroServerName(nitro)} built`);
    }
    if (nitro.options.logLevel > 1) {
      process.stdout.write(
        (await generateFSTree(nitro.options.output.serverDir, {
          compressedSizes: nitro.options.logging.compressedSizes,
        })) || ""
      );
    }
  }

  await nitro.hooks.callHook("compiled", nitro);

  // Show deploy and preview hints
  const rOutput = relative(process.cwd(), nitro.options.output.dir);
  const rewriteRelativePaths = (input: string) => {
    return input.replace(/([\s:])\.\/(\S*)/g, `$1${rOutput}/$2`);
  };
  if (buildInfo.commands!.preview) {
    nitro.logger.success(
      `You can preview this build using \`${rewriteRelativePaths(
        buildInfo.commands!.preview
      )}\``
    );
  }
  if (buildInfo.commands!.deploy) {
    nitro.logger.success(
      `You can deploy this build using \`${rewriteRelativePaths(
        buildInfo.commands!.deploy
      )}\``
    );
  }
}
