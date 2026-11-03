import type { RsbuildPlugin } from "@rsbuild/core";
import type { Nitro, NitroConfig } from "nitro/types";
import type { NitroRsbuildContext } from "./_context.ts";
import { resolveModulePath } from "exsolve";
import { createNitro } from "../../builder.ts";
import { baseConfig, configureEnvironments, nitroRspackConfig, NITRO_ENV } from "./_env.ts";
import { setupDevServer } from "./_dev.ts";
import { setupBuild } from "./_prod.ts";
import { setupPreview } from "./_preview.ts";
import { setupClientOutputs } from "./_client.ts";
import { setupAssetsImport } from "./_assets.ts";

export interface NitroRsbuildPluginConfig extends NitroConfig {
  /**
   * Existing Nitro instance to use instead of creating one (for frameworks that create Nitro themselves).
   */
  _nitro?: Nitro;
}

/**
 * Rsbuild plugin adding a `nitro` environment to the Rsbuild app, building the Nitro server with
 * the (experimental) `rspack` builder config.
 */
export function nitro(pluginConfig: NitroRsbuildPluginConfig = {}): RsbuildPlugin {
  return {
    name: "nitro",
    apply: (_config, { action }) => action === "dev" || action === "build" || action === "preview",
    setup(api) {
      if (api.context.action === "preview") {
        return setupPreview(api);
      }
      const ctx: NitroRsbuildContext = {
        dev: api.context.action === "dev",
        clientEnvs: [],
        runtimeIds: new Set(),
      };

      // Nitro is initialized first, so that other plugins see the base URL
      api.modifyRsbuildConfig({
        order: "pre",
        async handler(config, utils) {
          const original = api.getRsbuildConfig("original");
          ctx.nitro ??=
            pluginConfig._nitro ||
            (await initNitro(api.context.rootPath, pluginConfig, {
              dev: ctx.dev,
              baseURL: original.server?.base,
            }));
          return utils.mergeRsbuildConfig(config, baseConfig(ctx.nitro, original));
        },
      });

      // Environments are configured last, including the ones added by other plugins
      api.modifyRsbuildConfig({
        order: "post",
        handler: (config, utils) => configureEnvironments(ctx, config, utils),
      });

      api.modifyRspackConfig(async (config, utils) => {
        if (utils.environment.name === NITRO_ENV) {
          // `rspack` has all the exports of `@rspack/core`
          return nitroRspackConfig(
            ctx,
            config,
            utils.rspack as unknown as typeof import("@rspack/core")
          );
        }
      });

      api.onAfterCreateCompiler(({ compiler }) => {
        const compilers = "compilers" in compiler ? compiler.compilers : [compiler];
        ctx.compiler = compilers.find((c) => c.name === NITRO_ENV);
        ctx.compilers = compilers.filter((c) => c.name !== NITRO_ENV);
        setupClientOutputs(ctx);
        setupAssetsImport(ctx, compilers);
      });

      if (ctx.dev) {
        setupDevServer(api, ctx);
      } else {
        setupBuild(api, ctx);
      }
    },
  };
}

async function initNitro(
  rootDir: string,
  pluginConfig: NitroRsbuildPluginConfig,
  { dev, baseURL }: { dev: boolean; baseURL?: string }
) {
  const { _nitro, ...userConfig } = pluginConfig;
  // The base of the Rsbuild server is the base URL of Nitro
  const nitroConfig: NitroConfig = {
    rootDir,
    builder: "rspack",
    ...(baseURL ? { baseURL } : {}),
    ...userConfig,
    dev,
  };
  // Builds outside of Rsbuild (prerenderer) use the Rspack version of Rsbuild too
  const rspackPath = resolveRsbuildRspack(nitroConfig.rootDir!);
  if (rspackPath && !nitroConfig.deps?.paths?.["@rspack/core"]) {
    nitroConfig.deps = {
      ...nitroConfig.deps,
      paths: { ...nitroConfig.deps?.paths, "@rspack/core": rspackPath },
    };
  }
  return createNitro(nitroConfig);
}

function resolveRsbuildRspack(rootDir: string): string | undefined {
  const rsbuildPath = resolveModulePath("@rsbuild/core", { from: `${rootDir}/`, try: true });
  if (rsbuildPath) {
    return resolveModulePath("@rspack/core", { from: rsbuildPath, try: true });
  }
}
