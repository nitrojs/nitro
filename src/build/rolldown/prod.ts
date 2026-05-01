import type { Nitro } from "nitro/types";
import type { OutputOptions, RolldownOptions } from "rolldown";
import { formatCompatibilityDate } from "compatx";

import { relative } from "pathe";
import { scanHandlers } from "../../scan.ts";
import { generateFSTree } from "../../utils/fs-tree.ts";
import { writeTypes } from "../types.ts";
import { writeBuildInfo } from "../info.ts";
import type { RolldownOutput } from "rolldown";

export async function buildProduction(nitro: Nitro, config: RolldownOptions) {
  const rolldown = await import("rolldown");

  const buildStartTime = Date.now();

  await scanHandlers(nitro);
  await writeTypes(nitro);

  let output: RolldownOutput | undefined;
  if (!nitro.options.static) {
    nitro.logger.info(
      `Building server (builder: \`rolldown\`, preset: \`${nitro.options.preset}\`, compatibility date: \`${formatCompatibilityDate(nitro.options.compatibilityDate)}\`)`
    );
    const build = await rolldown.rolldown(config);
    output = (await build.write(config.output as OutputOptions)) as RolldownOutput;
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
  nitro.logger.success("You can preview this build using `npx nitro preview`");
  if (buildInfo.commands!.deploy) {
    nitro.logger.success(
      rewriteRelativePaths("You can deploy this build using `npx nitro deploy --prebuilt`")
    );
  }
}
