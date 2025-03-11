import type { Server as HttpServer } from "node:http";
import type { NitroApp } from "nitro/types";
import gracefulShutdown from "./lib/http-graceful-shutdown";

export function getGracefulShutdownConfig() {
  return {
    disabled: !!process.env.NITRO_SHUTDOWN_DISABLED,
    signals: (process.env.NITRO_SHUTDOWN_SIGNALS || "SIGTERM SIGINT")
      .split(" ")
      .map((s) => s.trim()),
    timeout:
      Number.parseInt(process.env.NITRO_SHUTDOWN_TIMEOUT || "", 10) || 30_000,
    forceExit: !process.env.NITRO_SHUTDOWN_NO_FORCE_EXIT,
  };
}

export function setupGracefulShutdown(
  listener: HttpServer,
  nitroApp: NitroApp
) {
  const shutdownConfig = getGracefulShutdownConfig();
  if (shutdownConfig.disabled) {
    return;
  }
  // https://github.com/sebhildebrandt/http-graceful-shutdown
  gracefulShutdown(listener, {
    signals: shutdownConfig.signals.join(" "),
    timeout: shutdownConfig.timeout,
    forceExit: shutdownConfig.forceExit,
    onShutdown: async () => {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn("Graceful shutdown timeout, force exiting...");
          resolve();
        }, shutdownConfig.timeout);
        nitroApp.hooks
          .callHook("close")
          .catch((error) => {
            console.error(error);
          })
          .finally(() => {
            clearTimeout(timeout);
            resolve();
          });
      });
    },
  });
}
