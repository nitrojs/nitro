import type { Nitro } from "nitro/types";
import type { Configuration, Stats } from "@rspack/core";
import { formatCompatibilityDate } from "compatx";
import { relative } from "pathe";
import { scanHandlers } from "../../scan.ts";
import { generateFSTree } from "../../utils/fs-tree.ts";
import { writeBuildInfo } from "../info.ts";
import { writeTypes } from "../types.ts";

export async function buildProduction(nitro: Nitro, config: Configuration) {
  const { rspack } = await import("@rspack/core");

  const buildStartTime = Date.now();

  await scanHandlers(nitro);
  await writeTypes(nitro);

  if (!nitro.options.static) {
    nitro.logger.info(
      `Building server (builder: \`rspack\`, preset: \`${nitro.options.preset}\`, compatibility date: \`${formatCompatibilityDate(nitro.options.compatibilityDate)}\`)`
    );

    await new Promise<void>((resolve, reject) => {
      const compiler = rspack(config);
      compiler.run((err, stats) => {
        if (err) {
          return reject(err);
        }
        if (stats?.hasErrors()) {
          const info = stats.toJson({ errors: true });
          const message = (info.errors || []).map((e) => e.message || String(e)).join("\n");
          return reject(new Error(message || "Rspack build failed"));
        }
        if (stats && nitro.options.logLevel > 1) {
          logStats(nitro, stats);
        }
        compiler.close(() => resolve());
      });
    });
  }

  const buildInfo = await writeBuildInfo(nitro, undefined);

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

  const rOutput = relative(process.cwd(), nitro.options.output.dir);
  const rewriteRelativePaths = (input: string) =>
    input.replace(/([\s:])\.\/(\S*)/g, `$1${rOutput}/$2`);

  nitro.logger.success("You can preview this build using `npx nitro preview`");
  if (buildInfo.commands?.deploy) {
    nitro.logger.success(
      rewriteRelativePaths("You can deploy this build using `npx nitro deploy --prebuilt`")
    );
  }
}

function logStats(nitro: Nitro, stats: Stats) {
  const warnings = stats.compilation.getWarnings();
  for (const warning of warnings) {
    nitro.logger.warn(warning.message || String(warning));
  }
}
