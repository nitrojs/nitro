import { useNitroApp } from "../app.ts";

export function resolveGracefulShutdownConfig() {
  const _timeout = Number.parseInt(process.env.NITRO_SHUTDOWN_TIMEOUT || "", 10);
  return process.env.NITRO_SHUTDOWN_DISABLED === "true"
    ? false
    : _timeout > 0
      ? { gracefulTimeout: _timeout / 1000 }
      : undefined;
}

export function setupShutdownHooks() {
  const handler = async () => {
    try {
      await useNitroApp().hooks?.callHook("close");
    } catch (error) {
      console.error("[nitro] Error running close hook:", error);
    }
  };
  for (const sig of ["SIGTERM", "SIGINT"] as const) {
    process.on(sig, handler);
  }
}
