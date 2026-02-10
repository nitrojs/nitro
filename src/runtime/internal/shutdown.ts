import { useNitroApp } from "../app.ts";
import type { ServerOptions } from "srvx";

export function resolveGracefulShutdownConfig(): ServerOptions["gracefulShutdown"] {
  if (process.env.NITRO_SHUTDOWN_DISABLED === "true") {
    return false;
  }

  const timeoutMs = Number.parseInt(process.env.NITRO_SHUTDOWN_TIMEOUT ?? "", 10);

  if (timeoutMs > 0) {
    // srvx expects timeout in seconds
    return { gracefulTimeout: timeoutMs / 1000 };
  }

  return undefined;
}

async function _shutdownHandler() {
  try {
    await useNitroApp().hooks?.callHook("close");
  } catch (error) {
    console.error("[nitro] Error running close hook:", error);
  }
}

export function setupShutdownHooks() {
  if (typeof process !== "undefined" && process.on) {
    process.on("SIGTERM", _shutdownHandler);
    process.on("SIGINT", _shutdownHandler);
  }
}
