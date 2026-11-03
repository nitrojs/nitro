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
  await beforeServerBuild(nitro);

  let stats: Stats | undefined;
  if (!nitro.options.static) {
    const compiler = rspack.rspack(config);
    stats = await new Promise<Stats | undefined>((resolve, reject) =>
      compiler.run((error, stats) => (error ? reject(error) : resolve(stats)))
    ).finally(() => new Promise((resolve) => compiler.close(resolve)));
    if (stats?.hasErrors()) {
      throw new Error(`Rspack build failed:\n${stats.toString("errors-only")}`);
    }
  }

  await afterServerBuild(nitro, { stats, startTime: buildStartTime });
}

/** Scans handlers before the server build (and compresses public assets). */
export async function beforeServerBuild(nitro: Nitro) {
  await scanHandlers(nitro);

  if (nitro.options.compressPublicAssets) {
    await compressPublicAssets(nitro);
  }

  if (!nitro.options.static) {
    nitro.logger.info(
      `Building server (builder: \`rspack\`, preset: \`${nitro.options.preset}\`, compatibility date: \`${formatCompatibilityDate(nitro.options.compatibilityDate)}\`)`
    );
  }
}

/** Writes the build info and logs the output after a (successful) server build. */
export async function afterServerBuild(nitro: Nitro, opts: { stats?: Stats; startTime: number }) {
  const { stats } = opts;
  if (stats?.hasWarnings()) {
    nitro.logger.warn(stats.toString("errors-warnings"));
  }

  // Split initial chunks (`_libs/*`) come first in the files of the entrypoint. The entry is
  // `index` unless `rspackConfig.entry` replaces it (a single string entry is named `main`).
  const entrypoints = stats?.compilation.entrypoints;
  const entrypoint =
    entrypoints?.get("index") ??
    (entrypoints?.size === 1 ? [...entrypoints.values()][0] : undefined);
  const entryChunk = entrypoint?.getEntrypointChunk();
  const entryFileName = [...(entryChunk?.files || [])].find((file) => /\.m?js$/.test(file));

  // Build info only needs the entry chunk of the output
  const output = entryFileName
    ? { output: [{ type: "chunk", isEntry: true, fileName: entryFileName }] }
    : undefined;
  await writeBuildInfo(nitro, output as Parameters<typeof writeBuildInfo>[1]);

  if (!nitro.options.static) {
    if (nitro.options.logging.buildSuccess) {
      nitro.logger.success(`Server built in ${Date.now() - opts.startTime}ms`);
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
