import type { Nitro } from "nitro/types";
import type { RolldownWatcher, RolldownOptions } from "rolldown";
import { watch } from "chokidar";
import { join } from "pathe";
import { debounce } from "perfect-debounce";
import { scanHandlers } from "../../scan";
import { nitroServerName } from "../../utils/nitro";
import { writeTypes } from "../types";

export async function watchDev(nitro: Nitro, config: RolldownOptions) {
  const rolldown = await import("rolldown");

  let watcher: RolldownWatcher;

  async function load() {
    if (watcher) {
      await watcher.close();
    }
    await scanHandlers(nitro);
    watcher = startWatcher(nitro, config);
    await writeTypes(nitro);
  }
  const reload = debounce(load);

  const watchPatterns = nitro.options.scanDirs.flatMap((dir) => [
    join(dir, nitro.options.apiDir || "api"),
    join(dir, nitro.options.routesDir || "routes"),
    join(dir, "middleware"),
    join(dir, "plugins"),
    join(dir, "modules"),
  ]);

  const watchReloadEvents = new Set(["add", "addDir", "unlink", "unlinkDir"]);
  const reloadWatcher = watch(watchPatterns, { ignoreInitial: true }).on(
    "all",
    (event) => {
      if (watchReloadEvents.has(event)) {
        reload();
      }
    }
  );

  nitro.hooks.hook("close", () => {
    watcher.close();
    reloadWatcher.close();
  });

  nitro.hooks.hook("rollup:reload", () => reload());

  await load();

  function startWatcher(nitro: Nitro, config: RolldownOptions) {
    const watcher = rolldown.watch(config);

    let start: number;

    watcher.on("event", (event) => {
      // START > BUNDLE_START > BUNDLE_END > END
      // START > BUNDLE_START > ERROR > END
      switch (event.code) {
        case "START": {
          start = Date.now();
          nitro.hooks.callHook("dev:start");
          break;
        }
        case "BUNDLE_END": {
          nitro.hooks.callHook("compiled", nitro);
          if (nitro.options.logging.buildSuccess) {
            nitro.logger.success(
              `${nitroServerName(nitro)} built with rolldown`,
              start ? `in ${Date.now() - start}ms` : ""
            );
          }
          nitro.hooks.callHook("dev:reload");
          break;
        }
        case "ERROR": {
          nitro.hooks.callHook("dev:error", event.error);
        }
      }
    });

    return watcher;
  }
}
