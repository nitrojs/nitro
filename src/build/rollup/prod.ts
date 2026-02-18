import type { Nitro, RollupConfig } from "nitro/types";
import { formatCompatibilityDate } from "compatx";
import { relative } from "pathe";
import { scanHandlers } from "../../scan.ts";
import { generateFSTree } from "../../utils/fs-tree.ts";
import { writeTypes } from "../types.ts";
import { writeBuildInfo } from "../info.ts";
import { formatRollupError } from "./error.ts";
import type { RollupOutput } from "rollup";

export async function buildProduction(nitro: Nitro, rollupConfig: RollupConfig) {
  const rollup = await import("rollup");

  const buildStartTime = Date.now();

  await scanHandlers(nitro);
  await writeTypes(nitro);

  let output: RollupOutput | undefined;
  if (!nitro.options.static) {
    nitro.logger.info(
      `Building server (builder: \`rollup\`, preset: \`${nitro.options.preset}\`, compatibility date: \`${formatCompatibilityDate(nitro.options.compatibilityDate)}\`)`
    );
    const build = await rollup.rollup(rollupConfig).catch((error) => {
      nitro.logger.error(formatRollupError(error));
      throw error;
    });

    output = await build.write(rollupConfig.output!);
  }

  const buildInfo = await writeBuildInfo(nitro, output);

  if (!nitro.options.static) {
    if (nitro.options.logging.buildSuccess) {
      nitro.logger.success(`Server built in ${Date.now() - buildStartTime}ms`);
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
      `You can preview this build using \`${rewriteRelativePaths(buildInfo.commands!.preview)}\``
    );
  }
  if (buildInfo.commands!.deploy) {
    nitro.logger.success(
      `You can deploy this build using \`${rewriteRelativePaths(buildInfo.commands!.deploy)}\``
    );
  }
}
