import type { Nitro } from "nitro/types";
import type { Configuration } from "@rspack/core";
import { formatCompatibilityDate } from "compatx";

export async function watchDev(nitro: Nitro, config: Configuration) {
  const { rspack } = await import("@rspack/core");

  nitro.logger.info(
    `Starting dev watcher (builder: \`rspack\`, preset: \`${nitro.options.preset}\`, compatibility date: \`${formatCompatibilityDate(nitro.options.compatibilityDate)}\`)`
  );

  const compiler = rspack(config);

  const watcher = compiler.watch({ aggregateTimeout: 300 }, (err, stats) => {
    if (err) {
      nitro.logger.error(err);
      nitro.hooks.callHook("dev:error", err);
      return;
    }
    if (stats?.hasErrors()) {
      const info = stats.toJson({ errors: true });
      for (const error of info.errors || []) {
        nitro.logger.error(error.message || String(error));
      }
      nitro.hooks.callHook("dev:error", new Error("Rspack build errors"));
      return;
    }
    nitro.hooks.callHook("compiled", nitro);
    if (nitro.options.logging.buildSuccess) {
      nitro.logger.success(`Server built`);
    }
    nitro.hooks.callHook("dev:reload");
  });

  nitro.hooks.hook("close", () => {
    watcher.close(() => {});
  });

  nitro.hooks.hook("rollup:reload", () => {
    watcher.invalidate();
  });
}
