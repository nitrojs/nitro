import type { EnvironmentContext, RsbuildPluginAPI } from "@rsbuild/core";
import type { Stats } from "@rspack/core";
import type { Nitro } from "nitro/types";
import type { NitroRsbuildContext } from "./_context.ts";
import { rm } from "node:fs/promises";
import { relative, resolve } from "pathe";
import { copyPublicAssets, prepare, prerender } from "../../builder.ts";
import { addClientAssetsDir } from "../assets.ts";
import { compressPublicAssets } from "../../utils/compress.ts";
import { createDevWatch } from "../rspack/dev.ts";
import { afterServerBuild, beforeServerBuild } from "../rspack/prod.ts";
import { useNitro } from "./_context.ts";

/**
 * The `nitro` environment is built after the client environments (emitted to the Nitro public
 * output): public assets are copied and routes prerendered right before it.
 *
 * With `rsbuild build --watch`, these steps run again before each server rebuild (the output is
 * only cleaned once), handlers are rescanned and the virtual modules rendered again.
 */
export function setupBuild(api: RsbuildPluginAPI, ctx: NitroRsbuildContext) {
  let startTime = Date.now();
  let stats: Stats | undefined;
  let watch = false;

  api.onBeforeBuild(async ({ isWatch, isFirstCompile }) => {
    watch = isWatch;
    // The `nitro` environment config prepares the output otherwise
    const nitro = useNitro(ctx);
    if (nitro.options.static && isFirstCompile) {
      await prepare(nitro);
      await nitro.hooks.callHook("build:before", nitro);
    }
  });

  api.onAfterCreateCompiler(({ environments }) => {
    const nitro = useNitro(ctx);
    const compiler = ctx.compiler;
    if (!compiler) {
      return;
    }
    const beforeBuild = async () => {
      startTime = Date.now();
      // Pages are rendered by the server (from the client HTML)
      if (ctx.pageTemplate) {
        await rm(resolve(nitro.options.output.publicDir, "index.html"), { force: true });
      }
      await beforeServer(nitro, environments);
      await beforeServerBuild(nitro);
    };
    compiler.hooks.run.tapPromise("nitro", beforeBuild);
    compiler.hooks.watchRun.tapPromise("nitro", async () => {
      await beforeBuild();
      // Added handlers (and server entries) rebuild the server, client outputs may have changed
      ctx.devWatch ??= createDevWatch(nitro, {
        pluginsHost: ctx.pluginsHost,
        invalidate: () => compiler.watching?.invalidate(),
      });
      await ctx.devWatch.scan();
      await ctx.devWatch.invalidateVirtual(compiler, { force: true });
    });
    compiler.hooks.done.tap("nitro", (_stats) => {
      stats = _stats;
    });
  });

  api.onAfterBuild(async ({ stats: buildStats, environments }) => {
    if (buildStats?.hasErrors()) {
      return;
    }
    const nitro = useNitro(ctx);
    if (nitro.options.static) {
      await beforeServer(nitro, environments);
      await beforeServerBuild(nitro);
    }
    await afterServerBuild(nitro, { stats, startTime });
    if (!watch) {
      await nitro.close();
    }
  });

  api.onCloseBuild(async () => {
    if (watch) {
      ctx.devWatch?.close();
      await useNitro(ctx).close();
    }
  });
}

async function beforeServer(nitro: Nitro, environments: Record<string, EnvironmentContext>) {
  await copyPublicAssets(nitro);
  addClientAssetsDirs(nitro, environments);
  await prerender(nitro);
  if (nitro.options.compressPublicAssets) {
    await compressPublicAssets(nitro);
  }
}

/** Hashed client assets (`static/` by default) are immutable, missing ones get a `no-store` 404. */
function addClientAssetsDirs(nitro: Nitro, environments: Record<string, EnvironmentContext>) {
  for (const env of Object.values(environments)) {
    if (env.config.output.target !== "web") {
      continue;
    }
    const { distPath } = env.config.output;
    for (const dir of [distPath.js, distPath.css, distPath.media, distPath.font, distPath.image]) {
      const first = dir?.split("/")[0];
      const base = first && relative(nitro.options.output.publicDir, resolve(env.distPath, first));
      if (base && !base.startsWith("..")) {
        addClientAssetsDir(nitro, base);
      }
    }
  }
  nitro.routing.sync();
}
