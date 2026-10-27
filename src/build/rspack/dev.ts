import type { Nitro } from "nitro/types";
import type { Compiler, Configuration, Watching } from "@rspack/core";
import { basename, join, normalize } from "pathe";
import { debounce } from "perfect-debounce";
import { scanHandlers } from "../../scan.ts";
import { createWatcher } from "../../utils/watch.ts";
import { formatCompatibilityDate } from "compatx";
import { isWindows } from "std-env";
import { pathRegExp } from "../../utils/regex.ts";
import { RollupPluginsHost } from "./_plugin.ts";

export async function watchDev(
  nitro: Nitro,
  config: Configuration,
  rspack: typeof import("@rspack/core")
) {
  let watching: Watching | undefined;
  let closed = false;
  // Virtual modules are rendered again by the next build
  let stale = false;
  let force = false;
  let handlers: string | undefined;

  const pluginsHost = config.plugins?.find((plugin) => plugin instanceof RollupPluginsHost);

  /** Scans handlers, returning whether they changed. */
  async function scan() {
    await scanHandlers(nitro);
    nitro.routing.sync();
    const scanned = JSON.stringify(nitro.scannedHandlers);
    const changed = scanned !== handlers;
    handlers = scanned;
    return changed;
  }

  const reload = debounce(async () => {
    const changed = await scan();
    if (changed || force) {
      force = false;
      stale = true;
      watching?.invalidate();
    }
  });

  const handlerDirs = nitro.options.scanDirs.flatMap((dir) => [
    join(dir, nitro.options.apiDir || "api"),
    join(dir, nitro.options.routesDir || "routes"),
    join(dir, "middleware"),
  ]);
  const otherDirs = nitro.options.scanDirs.flatMap((dir) => [
    join(dir, "plugins"),
    join(dir, "modules"),
  ]);

  const watchReloadEvents = new Set(["add", "addDir", "unlink", "unlinkDir"]);
  const scanDirsWatcher = createWatcher(nitro, [...handlerDirs, ...otherDirs], {
    ignoreInitial: true,
  }).on("all", (event, path) => {
    if (watchReloadEvents.has(event)) {
      // Changes of handler dirs only matter when the scanned handlers change
      const file = normalize(path);
      force ||= otherDirs.some((dir) => file === dir || file.startsWith(`${dir}/`));
      reload();
    }
  });

  const serverEntryRe = /^server\.[mc]?[jt]sx?$/;
  const rootDirWatcher = createWatcher(nitro, nitro.options.rootDir, {
    ignoreInitial: true,
    depth: 0,
  }).on("all", (event, path) => {
    if (watchReloadEvents.has(event) && serverEntryRe.test(basename(path))) {
      force = true;
      reload();
    }
  });

  nitro.hooks.hook("close", async () => {
    closed = true;
    const current = watching;
    watching = undefined;
    scanDirsWatcher.close();
    rootDirWatcher.close();
    if (current) {
      await new Promise<void>((resolve) => current.close(() => resolve()));
      await new Promise<void>((resolve) => current.compiler.close(() => resolve()));
    }
  });

  nitro.hooks.hook("build:reload", () => {
    force = true;
    return reload();
  });

  nitro.logger.info(
    `Starting dev watcher (builder: \`rspack\`, preset: \`${nitro.options.preset}\`, compatibility date: \`${formatCompatibilityDate(nitro.options.compatibilityDate)}\`)`
  );

  await scan();
  if (!closed) {
    watching = startWatcher();
  }

  /**
   * Marks the virtual modules as modified when handlers changed, so that they are rendered again
   * (the compiler and its cache are kept). Removed files are also seen by the Rspack watcher, which
   * can start the build before the scan dirs watcher, so handlers are scanned again then.
   */
  async function invalidateVirtual(compiler: Compiler) {
    if (!stale && compiler.removedFiles?.size) {
      stale = await scan();
    }
    if (!stale) {
      return;
    }
    stale = false;
    // Placeholder paths use `/`, Rspack may track them with native separators on Windows
    const virtualFiles = [...(pluginsHost?.virtual.ids.keys() || [])].flatMap((file) =>
      isWindows ? [file, file.replace(/\//g, "\\")] : [file]
    );
    compiler.modifiedFiles = new Set([...(compiler.modifiedFiles || []), ...virtualFiles]);
  }

  function startWatcher() {
    const compiler = rspack.rspack(config);

    let start: number;
    compiler.hooks.watchRun.tapPromise("nitro:dev", async (compiler) => {
      start = Date.now();
      nitro.hooks.callHook("dev:start");
      await invalidateVirtual(compiler);
    });

    return compiler.watch(
      {
        aggregateTimeout: 100,
        ignored: new RegExp(
          String.raw`[/\\]node_modules[/\\]|^${pathRegExp(nitro.options.output.dir.replace(/[/\\]+$/, ""))}(?:[/\\]|$)`
        ),
      },
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
