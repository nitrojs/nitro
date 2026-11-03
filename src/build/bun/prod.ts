import type { BunConfig, Nitro } from "nitro/types";
import type { RollupOutput } from "rollup";
import { formatCompatibilityDate } from "compatx";
import { relative } from "pathe";
import { scanHandlers } from "../../scan.ts";
import { generateFSTree } from "../../utils/fs-tree.ts";
import { compressPublicAssets } from "../../utils/compress.ts";
import { writeBuildInfo } from "../info.ts";
import type { PluginContainer } from "./_plugins.ts";
import { bundle } from "./_bundle.ts";

export async function buildProduction(nitro: Nitro, config: BunConfig, container: PluginContainer) {
  const buildStartTime = Date.now();

  await scanHandlers(nitro);

  if (nitro.options.compressPublicAssets) {
    await compressPublicAssets(nitro);
  }

  let output: RollupOutput | undefined;
  if (!nitro.options.static) {
    nitro.logger.info(
      `Building server (builder: \`bun\`, preset: \`${nitro.options.preset}\`, compatibility date: \`${formatCompatibilityDate(nitro.options.compatibilityDate)}\`)`
    );
    output = (await bundle(nitro, config, container)).output;
  }

  await writeBuildInfo(nitro, output);

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
  const previewCommand = nitro.options.framework.previewCommand || "npx nitro preview";
  nitro.logger.success(`You can preview this build using \`${previewCommand}\``);
  if (nitro.options.commands.deploy) {
    const deployCommand = nitro.options.framework.deployCommand || "npx nitro deploy --prebuilt";
    nitro.logger.success(
      rewriteRelativePaths(`You can deploy this build using \`${deployCommand}\``)
    );
  }
}
