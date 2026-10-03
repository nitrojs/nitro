import type { Server } from "srvx";
import { useNitroHooks } from "./app.ts";

/**
 * Call the Nitro `close` hooks when the server shuts down.
 *
 * srvx handles graceful shutdown on `SIGINT` and `SIGTERM` by calling `server.close()`,
 * with no knowledge of Nitro hooks. Wrapping `close` covers both the signal path and
 * explicit `server.close()` calls, and keeps hooks awaited as part of the shutdown.
 *
 * Hooks run once (a forced close after the graceful timeout awaits the same call) and
 * also run if the underlying close fails.
 */
export function setupCloseHooks(server: Server): void {
  const closeServer = server.close.bind(server);
  let closeHooks: Promise<void> | undefined;
  server.close = (closeActiveConnections?: boolean) =>
    closeServer(closeActiveConnections).finally(() => (closeHooks ??= callCloseHooks()));
}

async function callCloseHooks(): Promise<void> {
  try {
    await useNitroHooks().callHook("close");
  } catch (error) {
    console.error("[nitro] Error while calling `close` hooks:", error);
  }
}
