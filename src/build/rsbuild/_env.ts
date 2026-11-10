import type { ModifyRsbuildConfigUtils, RsbuildConfig, Rspack } from "@rsbuild/core";
import type { Nitro } from "nitro/types";
import type { NitroRsbuildContext } from "./_context.ts";
import { prepare } from "../../builder.ts";
import { scanHandlers } from "../../scan.ts";
import { getRspackConfig } from "../rspack/config.ts";
import { createDevWatch, hasEmittedAssets, watchIgnored } from "../rspack/dev.ts";
import { RollupPluginsHost } from "../rspack/_plugin.ts";
import { useNitro } from "./_context.ts";
import { configureServices } from "./_services.ts";

export const NITRO_ENV = "nitro";

/**
 * Adds the `nitro` environment (server build) next to the client environments (the default `web`
 * environment, unless environments are defined), which are emitted to the Nitro public output.
 */
export function configureEnvironments(
  ctx: NitroRsbuildContext,
  config: RsbuildConfig,
  { mergeRsbuildConfig }: ModifyRsbuildConfigUtils
): RsbuildConfig {
  const nitro = useNitro(ctx);

  const environments = { ...config.environments };
  if (Object.keys(environments).length === 0) {
    environments.web = {};
  }
  const clientEnvs = Object.entries(environments)
    .filter(
      ([name, env]) =>
        name !== NITRO_ENV && (env.output?.target ?? config.output?.target ?? "web") === "web"
    )
    .map(([name]) => name);
  // Pages are owned by the `client` environment (then `web`, then the first client environment)
  const pageEnv = ["client", "web"].find((name) => clientEnvs.includes(name)) ?? clientEnvs[0];
  ctx.clientEnvs = pageEnv ? [pageEnv, ...clientEnvs.filter((name) => name !== pageEnv)] : [];

  configureServices(ctx, config, environments, [NITRO_ENV, ...ctx.clientEnvs]);

  // Client assets are emitted to the public output of Nitro (cleaned by `prepare`), also for
  // environments with their own output directory (e.g. set by a framework plugin)
  const clientOutput: RsbuildConfig["output"] = ctx.dev
    ? undefined
    : { distPath: { root: nitro.options.output.publicDir }, cleanDistPath: false };
  if (clientOutput) {
    for (const name of ctx.clientEnvs) {
      environments[name] = mergeRsbuildConfig(environments[name]!, { output: clientOutput });
    }
  }

  if (!nitro.options.static) {
    environments[NITRO_ENV] = {
      source: { entry: { index: nitro.options.entry } },
      output: {
        target: "node",
        distPath: { root: nitro.options.output.serverDir },
        cleanDistPath: false,
      },
      dev: { writeToDisk: true, hmr: false, liveReload: false },
      // Nitro prints the server output
      performance: { printFileSize: false },
    };
  }

  return mergeRsbuildConfig(config, { environments, output: clientOutput });
}

/**
 * Serves the client pages and assets under the base URL of Nitro, unless the Rsbuild server has a
 * base (then the base URL of Nitro, see `initNitro`).
 */
export function baseConfig(nitro: Nitro, original: RsbuildConfig): RsbuildConfig {
  const base = nitro.options.baseURL;
  if (original.server?.base || !base || base === "/") {
    return {};
  }
  return {
    server: { base },
    ...(original.dev?.assetPrefix === undefined && { dev: { assetPrefix: base } }),
    ...(original.output?.assetPrefix === undefined && { output: { assetPrefix: base } }),
  };
}

/**
 * Rspack config of the `nitro` environment: the `rspack` builder config, keeping the Rsbuild core
 * plugin (compile hooks of Rsbuild) but not the Rsbuild rules and defines (Nitro has its own).
 */
export async function nitroRspackConfig(
  ctx: NitroRsbuildContext,
  rsbuildConfig: Rspack.Configuration,
  rspack: typeof import("@rspack/core")
): Promise<Rspack.Configuration> {
  const nitro = useNitro(ctx);
  await prepare(nitro);

  // Presets set up the build in `build:before` (e.g. the Cloudflare dev runner and externals)
  await nitro.hooks.callHook("build:before", nitro);
  const config = (await getRspackConfig(nitro, rspack)) as Rspack.Configuration;
  await nitro.hooks.callHook("build:config", nitro, { builder: "rspack", rspack: config });
  ctx.pluginsHost = config.plugins?.find((plugin) => plugin instanceof RollupPluginsHost);
  if (ctx.dev) {
    ctx.devWatch ??= createDevWatch(nitro, {
      pluginsHost: ctx.pluginsHost,
      invalidate: () => ctx.compiler?.watching?.invalidate(),
      // Services are imported from their output by the dev worker
      outputChanged: (stats) => {
        const changed = !!ctx.servicesChanged || hasEmittedAssets(stats);
        ctx.servicesChanged = false;
        return changed;
      },
    });
    await ctx.devWatch.scan();
  } else {
    await scanHandlers(nitro);
  }

  const rsbuildPlugins = (rsbuildConfig.plugins || []).filter(
    (plugin) => !(plugin instanceof rspack.DefinePlugin)
  );
  return {
    ...config,
    name: rsbuildConfig.name,
    plugins: [...rsbuildPlugins, ...(config.plugins || [])],
    // Development and `rsbuild build --watch`
    watchOptions: { ...rsbuildConfig.watchOptions, ignored: watchIgnored(nitro, ctx.pluginsHost) },
    // Service outputs are imported by the server, prerendering and public assets need the client output
    dependencies: [...(ctx.dev ? [] : ctx.clientEnvs), ...Object.keys(ctx.services || {})],
  };
}
