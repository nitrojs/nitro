import { useNitroApp } from "../app.ts";

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
