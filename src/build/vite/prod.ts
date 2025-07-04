import type { Nitro } from "nitro/types";
import type { ViteBuilder } from "vite";
import { relative } from "node:path";
import { copyPublicAssets, prerender } from "../..";
import { nitroServerName } from "../../utils/nitro";
import { formatCompatibilityDate } from "compatx";

export async function buildProduction(nitro: Nitro, builder: ViteBuilder) {
  nitro.logger.start(
    `Building \`${nitroServerName(nitro)}\` (preset: \`${nitro.options.preset}\`, compatibility date: \`${formatCompatibilityDate(nitro.options.compatibilityDate)}\`)`
  );

  // Call the rollup:before hook for compatibility
  await nitro.hooks.callHook(
    "rollup:before",
    nitro,
    builder.environments.nitro.config.build.rollupOptions as any
  );

  // Copy public assets to the final output directory
  await copyPublicAssets(nitro);

  // Prerender routes if configured
  await prerender(nitro);

  // Build the Nitro server bundle
  await builder.build(builder.environments.nitro);

  // Close the Nitro instance
  await nitro.close();

  // Call compiled hook
  await nitro.hooks.callHook("compiled", nitro);

  // Show deploy and preview commands
  const rOutput = relative(process.cwd(), nitro.options.output.dir);
  const rewriteRelativePaths = (input: string) => {
    return input.replace(/([\s:])\.\/(\S*)/g, `$1${rOutput}/$2`);
  };
  if (nitro.options.commands.preview) {
    nitro.logger.success(
      `You can preview this build using \`${rewriteRelativePaths(
        nitro.options.commands.preview
      )}\``
    );
  }
  if (nitro.options.commands.deploy) {
    nitro.logger.success(
      `You can deploy this build using \`${rewriteRelativePaths(
        nitro.options.commands.deploy
      )}\``
    );
  }
}
