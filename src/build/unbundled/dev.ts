import type { Nitro } from "nitro/types";
import { formatCompatibilityDate } from "compatx";
import { normalize } from "pathe";
import { withTrailingSlash } from "ufo";
import { debounce } from "perfect-debounce";
import { scanHandlers } from "../../scan.ts";
import { createWatcher } from "../../utils/watch.ts";
import { prepareUnbundledApp } from "./entry.ts";
import { unbundledPlugins } from "./plugins.ts";

// Dependencies, and dot directories (build output, `.data`, `.wrangler`, ...) the app may write to
const ignoredRe = /(?:^|\/)(?:node_modules|\.[^/]+)(?:\/|$)/;

// Files that can be part of the server: scripts, and files imported as text, bytes or WASM
const sourceRe = /\.(?:[cm]?[jt]sx?|json|wasm|txt|html|md|ya?ml|toml|sql)$/;

export async function watchDev(nitro: Nitro) {
  nitro.logger.info(
    `Starting dev server without a builder (preset: \`${nitro.options.preset}\`, compatibility date: \`${formatCompatibilityDate(nitro.options.compatibilityDate)}\`)`
  );

  const plugins = await unbundledPlugins(nitro);

  async function load() {
    await nitro.hooks.callHook("dev:start");
    try {
      await scanHandlers(nitro);
      nitro.routing.sync();
      const { entry, virtual } = await prepareUnbundledApp(nitro);
      await nitro.hooks.callHook("compiled", nitro);
      await nitro.hooks.callHook("dev:reload", { entry, workerData: { virtual }, plugins });
    } catch (error) {
      nitro.logger.error(error);
      await nitro.hooks.callHook("dev:error", error);
    }
  }
  const reload = debounce(load);

  // Without a module graph, any source change starts a fresh worker
  const { rootDir, scanDirs, buildDir, output, publicAssets, watchOptions } = nitro.options;
  const watchDirs = [...new Set([rootDir, ...scanDirs].map((dir) => withTrailingSlash(dir)))];
  const ignoredDirs = [buildDir, output.dir, ...publicAssets.map((asset) => asset.dir)].map((dir) =>
    withTrailingSlash(dir)
  );
  const watcher = createWatcher(nitro, watchDirs, {
    ignoreInitial: true,
    ...watchOptions,
    ignored: [
      (path) => {
        path = normalize(path);
        const watchDir = watchDirs.find((dir) => path.startsWith(dir));
        return (
          (watchDir !== undefined && ignoredRe.test(path.slice(watchDir.length))) ||
          ignoredDirs.some((dir) => path.startsWith(dir))
        );
      },
      ...[watchOptions?.ignored ?? []].flat(),
    ],
  }).on("all", (event, path) => {
    if (event === "addDir" || event === "unlinkDir" || sourceRe.test(path)) {
      reload();
    }
  });

  nitro.hooks.hook("close", () => watcher.close());
  nitro.hooks.hook("rollup:reload", () => reload());

  await load();
}
