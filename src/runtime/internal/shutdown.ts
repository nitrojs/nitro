import { useNitroApp } from "../app.ts";

export function setupShutdownHooks() {
  const handler = () => {
    useNitroApp().hooks?.callHook("close");
  };
  for (const sig of ["SIGTERM", "SIGINT"] as const) {
    process.on(sig, handler);
  }
}
