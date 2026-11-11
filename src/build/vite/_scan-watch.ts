import type { Nitro } from "nitro/types";
import type { DevEnvironment, ViteDevServer } from "vite";
import { basename, dirname, join, normalize } from "pathe";
import { scanHandlers } from "../../scan.ts";
import { onWatchError } from "../../utils/watch.ts";

const serverEntryRe = /^server\.[mc]?[jt]sx?$/;
const watchReloadEvents = new Set(["add", "addDir", "unlink", "unlinkDir"]);

/**
 * Calls `onChange` when files are added to or removed from the scan dirs (or a root `server.*`
 * entry), when a `public/` dir is removed, and on the `build:reload` hook.
 */
export function watchScanDirs(nitro: Nitro, server: ViteDevServer, onChange: () => void): void {
  const scanDirs = nitro.options.scanDirs.flatMap((dir) => [
    join(dir, nitro.options.apiDir || "api"),
    join(dir, nitro.options.routesDir || "routes"),
    join(dir, "middleware"),
    join(dir, "plugins"),
    join(dir, "modules"),
    join(dir, "tasks"),
  ]);
  const publicDirs = [nitro.options.rootDir, ...nitro.options.scanDirs].map((dir) =>
    join(dir, "public")
  );

  const shouldReload = (path: string) => {
    path = normalize(path);
    return (
      scanDirs.some((dir) => path === dir || path.startsWith(dir + "/")) ||
      (serverEntryRe.test(basename(path)) && dirname(path) + "/" === nitro.options.rootDir)
    );
  };

  // Reuse vite's watcher (root is already watched) to avoid extra system watchers
  server.watcher.on("error", (error) => onWatchError(nitro, error));
  server.watcher.add(
    [...scanDirs, ...publicDirs].filter((dir) => !dir.startsWith(server.config.root + "/"))
  );
  server.watcher.on("all", (event, path) => {
    if (
      (watchReloadEvents.has(event) && shouldReload(path)) ||
      (event === "unlinkDir" && publicDirs.includes(normalize(path)))
    ) {
      onChange();
    }
  });
  nitro.hooks.hook("build:reload", () => onChange());
}

/**
 * Rescans handlers and invalidates the `nitro` environment, so virtual modules render again.
 */
export async function rescanHandlers(nitro: Nitro, env: DevEnvironment): Promise<void> {
  await scanHandlers(nitro);
  nitro.routing.sync();
  env.moduleGraph.invalidateAll();
}
