import type { Nitro } from "nitro/types";
import type { Configuration, Watching } from "@rspack/core";
import { basename, join } from "pathe";
import { debounce } from "perfect-debounce";
import { scanHandlers } from "../../scan.ts";
import { createWatcher } from "../../utils/watch.ts";
import { formatCompatibilityDate } from "compatx";

export async function watchDev(
  nitro: Nitro,
  config: Configuration,
  rspack: typeof import("@rspack/core")
) {
  let watching: Watching | undefined;
  let closed = false;

  const closeWatching = async () => {
    const current = watching;
    watching = undefined;
    if (current) {
      await new Promise<void>((resolve) => current.close(() => resolve()));
      await new Promise<void>((resolve) => current.compiler.close(() => resolve()));
    }
  };

  async function load() {
    await closeWatching();
    await scanHandlers(nitro);
    nitro.routing.sync();
    if (closed) {
      return;
    }
    // A new compiler, so virtual modules (e.g. routes) are rendered again
    watching = startWatcher();
  }
  const reload = debounce(load);

  const scanDirs = nitro.options.scanDirs.flatMap((dir) => [
    join(dir, nitro.options.apiDir || "api"),
    join(dir, nitro.options.routesDir || "routes"),
    join(dir, "middleware"),
    join(dir, "plugins"),
    join(dir, "modules"),
  ]);

  const watchReloadEvents = new Set(["add", "addDir", "unlink", "unlinkDir"]);
  const scanDirsWatcher = createWatcher(nitro, scanDirs, {
    ignoreInitial: true,
  }).on("all", (event) => {
    if (watchReloadEvents.has(event)) {
      reload();
    }
  });

  const serverEntryRe = /^server\.[mc]?[jt]sx?$/;
  const rootDirWatcher = createWatcher(nitro, nitro.options.rootDir, {
    ignoreInitial: true,
    depth: 0,
  }).on("all", (event, path) => {
    if (watchReloadEvents.has(event) && serverEntryRe.test(basename(path))) {
      reload();
    }
  });

  nitro.hooks.hook("close", async () => {
    closed = true;
    await closeWatching();
    scanDirsWatcher.close();
    rootDirWatcher.close();
  });

  nitro.hooks.hook("build:reload", () => reload());

  nitro.logger.info(
    `Starting dev watcher (builder: \`rspack\`, preset: \`${nitro.options.preset}\`, compatibility date: \`${formatCompatibilityDate(nitro.options.compatibilityDate)}\`)`
  );

  await load();

  function startWatcher() {
    const compiler = rspack.rspack(config);

    let start: number;
    compiler.hooks.watchRun.tap("nitro:dev", () => {
      start = Date.now();
      nitro.hooks.callHook("dev:start");
    });

    return compiler.watch(
      { aggregateTimeout: 100, ignored: ["**/node_modules/**", nitro.options.output.dir] },
      (error, stats) => {
        if (error || stats?.hasErrors()) {
          const buildError = error || new Error(stats!.toString("errors-only"));
          nitro.logger.error(buildError);
          nitro.hooks.callHook("dev:error", buildError);
          return;
        }
        nitro.hooks.callHook("compiled", nitro);
        if (nitro.options.logging.buildSuccess) {
          nitro.logger.success(`Server built`, start ? `in ${Date.now() - start}ms` : "");
        }
        nitro.hooks.callHook("dev:reload");
      }
    );
  }
}
