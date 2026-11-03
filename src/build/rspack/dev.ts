import type { Nitro } from "nitro/types";
import type { Compiler, Configuration, Stats, Watching } from "@rspack/core";
import { existsSync } from "node:fs";
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

  const pluginsHost = config.plugins?.find((plugin) => plugin instanceof RollupPluginsHost);
  const devWatch = createDevWatch(nitro, {
    pluginsHost,
    invalidate: () => watching?.invalidate(),
  });

  nitro.hooks.hook("close", async () => {
    closed = true;
    const current = watching;
    watching = undefined;
    devWatch.close();
    if (current) {
      await new Promise<void>((resolve) => current.close(() => resolve()));
      await new Promise<void>((resolve) => current.compiler.close(() => resolve()));
    }
  });

  nitro.logger.info(
    `Starting dev watcher (builder: \`rspack\`, preset: \`${nitro.options.preset}\`, compatibility date: \`${formatCompatibilityDate(nitro.options.compatibilityDate)}\`)`
  );

  await devWatch.scan();
  if (closed) {
    return;
  }
  const compiler = rspack.rspack(config);
  devWatch.attach(compiler);
  watching = compiler.watch({ ignored: devWatch.ignored }, () => {});
}

export interface DevWatch {
  /** Scans handlers, returning whether they changed. */
  scan: () => Promise<boolean>;
  /** Watch `ignored` option (output and virtual module placeholders). */
  ignored: RegExp;
  /** Reloads Nitro (and renders virtual modules again) when the compiler rebuilds. */
  attach: (compiler: Compiler) => void;
  /** Rebuilds the server, rendering the virtual modules again. */
  rebuild: () => void;
  /** Renders the virtual modules again in the next build of the compiler (if handlers changed). */
  invalidateVirtual: (compiler: Compiler, opts?: { force?: boolean }) => Promise<void>;
  close: () => void;
}

/**
 * Dev watch of a compiler building the Nitro server: rescans handlers when files are added or
 * removed in scan dirs (to render the virtual modules again), and reloads the dev server after
 * each build.
 */
export function createDevWatch(
  nitro: Nitro,
  opts: {
    pluginsHost?: RollupPluginsHost;
    invalidate: () => void;
    /** Whether the server output changed (default: assets were emitted), to skip unchanged reloads. */
    outputChanged?: (stats: Stats) => boolean;
  }
): DevWatch {
  const { pluginsHost } = opts;
  // Virtual modules are rendered again by the next build
  let stale = false;
  let force = false;
  let handlers: string | undefined;

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
      opts.invalidate();
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

  nitro.hooks.hook("build:reload", () => {
    force = true;
    return reload();
  });

  /**
   * Marks the virtual modules as modified when handlers changed, so that they are rendered again
   * (the compiler and its cache are kept). Removed files are also seen by the Rspack watcher, which
   * can start the build before the scan dirs watcher, so handlers are scanned again then.
   */
  async function invalidateVirtual(compiler: Compiler, { force }: { force?: boolean } = {}) {
    stale ||= !!force;
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

  const ignored = watchIgnored(nitro, pluginsHost);

  function attach(compiler: Compiler) {
    let start: number;
    // Builds without input changes (rebuilt dependencies, or existing files that the Rspack watcher
    // reports as removed at startup on Windows) only reload the worker when the output changed
    let inputChanged = true;
    let reloaded = false;
    compiler.hooks.watchRun.tapPromise("nitro:dev", async (compiler) => {
      start = Date.now();
      await invalidateVirtual(compiler);
      inputChanged =
        !reloaded ||
        !!compiler.modifiedFiles?.size ||
        [...(compiler.removedFiles || [])].some((file) => !existsSync(file));
      if (inputChanged) {
        nitro.hooks.callHook("dev:start");
      }
    });
    compiler.hooks.done.tap("nitro:dev", (stats) => {
      if (stats.hasErrors()) {
        reloaded = false;
        const buildError = new Error(stats.toString("errors-only"));
        nitro.logger.error(buildError);
        nitro.hooks.callHook("dev:error", buildError);
        return;
      }
      const outputChanged = (opts.outputChanged || hasEmittedAssets)(stats);
      if (!inputChanged && !outputChanged) {
        return;
      }
      reloaded = true;
      if (stats.hasWarnings()) {
        nitro.logger.warn(stats.toString("errors-warnings"));
      }
      nitro.hooks.callHook("compiled", nitro);
      if (nitro.options.logging.buildSuccess) {
        nitro.logger.success(`Server built`, start ? `in ${Date.now() - start}ms` : "");
      }
      nitro.hooks.callHook("dev:reload");
    });
    compiler.hooks.failed.tap("nitro:dev", (error) => {
      reloaded = false;
      nitro.logger.error(error);
      nitro.hooks.callHook("dev:error", error);
    });
  }

  return {
    scan,
    ignored,
    attach,
    invalidateVirtual,
    rebuild: () => {
      stale = true;
      opts.invalidate();
    },
    close: () => {
      scanDirsWatcher.close();
      rootDirWatcher.close();
    },
  };
}

/** Whether a build wrote assets (unchanged assets are not written again). */
export function hasEmittedAssets(stats: Stats): boolean {
  return !!stats.toJson({ all: false, assets: true }).assets?.some((asset) => asset.emitted);
}

/** Watch `ignored` option: virtual module placeholders are marked as modified by `invalidateVirtual`. */
export function watchIgnored(nitro: Nitro, pluginsHost?: RollupPluginsHost): RegExp {
  const ignoredDirs = [nitro.options.output.dir, pluginsHost?.virtual.dir]
    .filter((dir) => dir !== undefined)
    .map((dir) => pathRegExp(dir.replace(/[/\\]+$/, "")));
  return new RegExp(String.raw`[/\\]node_modules[/\\]|^(?:${ignoredDirs.join("|")})(?:[/\\]|$)`);
}
