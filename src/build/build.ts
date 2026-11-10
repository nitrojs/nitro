import type { Nitro } from "nitro/types";
import { existsSync } from "node:fs";
import { compressPublicAssets } from "../utils/compress.ts";
import { createWatcher } from "../utils/watch.ts";

export async function build(nitro: Nitro) {
  if (!nitro.options.dev && nitro.options.compressPublicAssets) {
    nitro.hooks.hookOnce("close", async () => {
      if (existsSync(nitro.options.output.publicDir)) {
        await compressPublicAssets(nitro);
      }
    });
  }
  if (nitro.options.dev && nitro.options.builder === false) {
    watchRendererTemplate(nitro);
  }
  warnUnbuiltServices(nitro);
  switch (nitro.options.builder) {
    case "rollup": {
      const { rollupBuild } = await import("./rollup/build.ts");
      return rollupBuild(nitro);
    }
    case "rolldown": {
      const { rolldownBuild } = await import("./rolldown/build.ts");
      return rolldownBuild(nitro);
    }
    case "rspack": {
      const { rspackBuild } = await import("./rspack/build.ts");
      return rspackBuild(nitro);
    }
    case "bun": {
      const { bunBuild } = await import("./bun/build.ts");
      return bunBuild(nitro);
    }
    case "vite": {
      const { viteBuild } = await import("./vite/build.ts");
      return viteBuild(nitro);
    }
    case false: {
      const { unbundledBuild } = await import("./unbundled/build.ts");
      return unbundledBuild(nitro);
    }
    default: {
      throw new Error(`Unknown builder: ${nitro.options.builder}`);
    }
  }
}

// The renderer template is compiled at build time: rebuild when it changes (bundlers watch it
// from the virtual module)
function watchRendererTemplate(nitro: Nitro) {
  const template = nitro.options.renderer?.template;
  if (!template) {
    return;
  }
  const watcher = createWatcher(nitro, template, {
    ...nitro.options.watchOptions,
    ignoreInitial: true,
  }).on("all", () => nitro.hooks.callHook("build:reload"));
  nitro.hooks.hook("close", () => watcher.close());
}

// Services are built by a builder integration (e.g. `nitro/vite`), which sets `_serviceLoader`
function warnUnbuiltServices(nitro: Nitro) {
  const names = Object.keys({ ...nitro.options.vite?.services, ...nitro.options.services });
  const { builder } = nitro.options;
  // The prerenderer of the app reuses its services (warned once, by the app build)
  if (
    names.length === 0 ||
    nitro._serviceLoader ||
    builder === "vite" ||
    nitro.options.preset === "nitro-prerender"
  ) {
    return;
  }
  nitro.logger.warn(
    `Services (${names.join(", ")}) are not built ${builder ? `by the \`${builder}\` builder` : "without a builder"} and are ignored.`
  );
}
