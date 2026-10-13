import type { Nitro } from "nitro/types";
import type { ChokidarOptions, FSWatcher } from "chokidar";
import { watch } from "chokidar";

/**
 * Create a chokidar watcher that degrades gracefully (with a warning) instead of
 * crashing the dev server on watcher errors such as `ENOSPC` (system watcher limit).
 */
export function createWatcher(
  nitro: Nitro,
  paths: string | string[],
  options?: ChokidarOptions
): FSWatcher {
  return watch(paths, options).on("error", (error) => onWatchError(nitro, error));
}

export function onWatchError(nitro: Pick<Nitro, "logger">, error: unknown) {
  const code = (error as NodeJS.ErrnoException)?.code || "";
  if (warnedCodes.has(code)) {
    return;
  }
  warnedCodes.add(code);
  if (code === "ENOSPC" || code === "EMFILE") {
    nitro.logger.warn(
      `System limit for file watchers reached (${code}). Some file changes may not be detected until the dev server is restarted.` +
        (process.platform === "linux"
          ? " You can increase the limit with `sudo sysctl fs.inotify.max_user_watches=524288`."
          : "")
    );
    return;
  }
  nitro.logger.warn("File watcher error:", error);
}

const warnedCodes = new Set<string>();
