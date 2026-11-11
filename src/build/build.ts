import type { Nitro } from "nitro/types";
import { existsSync } from "node:fs";
import { normalize, resolve } from "pathe";
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
  if (nitro.options.dev) {
    watchPublicDirs(nitro);
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

// Public dirs are served from disk in development, but the public assets manifest of the dev worker
// is rendered at build time: rebuild when a public dir is removed, so its files are no longer served
function watchPublicDirs(nitro: Nitro) {
  const dirs = [
    ...new Set([nitro.options.rootDir, ...nitro.options.scanDirs].map((dir) => resolve(dir))),
  ];
  const publicDirs = new Set(dirs.map((dir) => resolve(dir, "public")));
  const watcher = createWatcher(nitro, dirs, {
    ...nitro.options.watchOptions,
    ignoreInitial: true,
    depth: 0,
  }).on("unlinkDir", (path) => {
    if (publicDirs.has(normalize(path))) {
      nitro.hooks.callHook("build:reload");
    }
  });
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
