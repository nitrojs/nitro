import type { Nitro } from "nitro/types";
import type { Configuration, Stats } from "@rspack/core";
import { formatCompatibilityDate } from "compatx";

import { relative } from "pathe";
import { scanHandlers } from "../../scan.ts";
import { generateFSTree } from "../../utils/fs-tree.ts";
import { writeBuildInfo } from "../info.ts";
import { compressPublicAssets } from "../../utils/compress.ts";

export async function buildProduction(
  nitro: Nitro,
  config: Configuration,
  rspack: typeof import("@rspack/core")
) {
  const buildStartTime = Date.now();

  await scanHandlers(nitro);

  if (nitro.options.compressPublicAssets) {
    await compressPublicAssets(nitro);
  }

  let entryFileName: string | undefined;
  if (!nitro.options.static) {
    nitro.logger.info(
      `Building server (builder: \`rspack\`, preset: \`${nitro.options.preset}\`, compatibility date: \`${formatCompatibilityDate(nitro.options.compatibilityDate)}\`)`
    );
    const compiler = rspack.rspack(config);
    const stats = await new Promise<Stats | undefined>((resolve, reject) =>
      compiler.run((error, stats) => (error ? reject(error) : resolve(stats)))
    ).finally(() => new Promise((resolve) => compiler.close(resolve)));
    if (stats?.hasWarnings()) {
      nitro.logger.warn(stats.toString("errors-warnings"));
    }
    if (stats?.hasErrors()) {
      throw new Error(`Rspack build failed:\n${stats.toString("errors-only")}`);
    }
    entryFileName = stats?.compilation.entrypoints
      .get("index")
      ?.getFiles()
      .find((file) => /\.m?js$/.test(file));
  }

  // Build info only needs the entry chunk of the output
  const output = entryFileName
    ? { output: [{ type: "chunk", isEntry: true, fileName: entryFileName }] }
    : undefined;
  const buildInfo = await writeBuildInfo(nitro, output as Parameters<typeof writeBuildInfo>[1]);

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
