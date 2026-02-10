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

function _onShutdownSignal() {
  useNitroApp().hooks?.callHook("close");
}

export function setupShutdownHooks() {
  process.on("SIGTERM", _onShutdownSignal);
  process.on("SIGINT", _onShutdownSignal);
}
