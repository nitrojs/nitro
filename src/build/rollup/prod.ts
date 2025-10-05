import type { Nitro, RollupConfig } from "nitro/types";
import { formatCompatibilityDate } from "compatx";
import { relative } from "pathe";
import { scanHandlers } from "../../scan";
import { generateFSTree } from "../../utils/fs-tree";
import { nitroServerName } from "../../utils/nitro";
import { writeTypes } from "../types";
import { snapshot } from "../snapshot";
import { writeBuildInfo } from "../info";
import { formatRollupError } from "./error";

export async function buildProduction(
  nitro: Nitro,
  rollupConfig: RollupConfig
) {
  const rollup = await import("rollup");

  await scanHandlers(nitro);
  await writeTypes(nitro);
  await snapshot(nitro);

  if (!nitro.options.static) {
    nitro.logger.info(
      `Building ${nitroServerName(nitro)} (rollup, preset: \`${nitro.options.preset}\`, compatibility date: \`${formatCompatibilityDate(nitro.options.compatibilityDate)}\`)`
    );
    const build = await rollup.rollup(rollupConfig).catch((error) => {
      nitro.logger.error(formatRollupError(error));
      throw error;
    });

    await build.write(rollupConfig.output);
  }

  const buildInfo = await writeBuildInfo(nitro);

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
