import type { Server } from "srvx";
import type { NitroShutdownContext } from "nitro/types";
import { useNitroHooks } from "./app.ts";

/**
 * Call the Nitro `shutdown` and `close` hooks when the server shuts down.
 *
 * srvx handles graceful shutdown on `SIGINT` and `SIGTERM` by calling `server.close()`,
 * with no knowledge of Nitro hooks. Wrapping `close` covers both the signal path and
 * explicit `server.close()` calls, and keeps hooks awaited as part of the shutdown.
 *
 * `shutdown` hooks are called as soon as the server starts closing. Until the HTTP drain ends
 * and the work registered with `waitUntil` settles, for up to the graceful shutdown timeout of
 * srvx, more work can be registered. `close` hooks are called after that.
 *
 * Hooks run once (a forced close after the graceful timeout awaits the same call) and
 * also run if the underlying close fails.
 */
export function setupCloseHooks(server: Server): void {
  const closeServer = server.close.bind(server);
  let shutdown: Promise<void> | undefined;
  let closeHooks: Promise<void> | undefined;
  server.close = (closeActiveConnections?: boolean) => {
    const closing = closeServer(closeActiveConnections);
    shutdown ??= callShutdownHooks({ timeout: resolveShutdownTimeout(server), closing });
    return closing.finally(() => (closeHooks ??= shutdown!.then(callCloseHooks)));
  };
}

async function callCloseHooks(): Promise<void> {
  try {
    await useNitroHooks().callHook("close");
  } catch (error) {
    console.error("[nitro] Error while calling `close` hooks:", error);
  }
}

async function callShutdownHooks({
  timeout,
  closing,
}: {
  timeout: number;
  closing: Promise<void>;
}): Promise<void> {
  const controller = new AbortController();
  let pending = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[nitro] Shutdown did not finish within ${timeout}ms.`);
      controller.abort();
      resolve();
    }, timeout);
    const waitUntil: NitroShutdownContext["waitUntil"] = (promise) => {
      pending++;
      Promise.resolve(promise)
        .catch((error) => console.error("[nitro] Error while shutting down:", error))
        .finally(() => --pending || resolve());
    };
    // Errors of the server close are thrown to the caller
    waitUntil(closing.catch(() => {}));
    waitUntil(
      Promise.resolve(
        useNitroHooks().callHook("shutdown", { waitUntil, signal: controller.signal })
      )
    );
  });
  clearTimeout(timer);
}

// Same as the graceful shutdown timeout of srvx
function resolveShutdownTimeout(server: Server): number {
  const config = server.options?.gracefulShutdown;
  const seconds =
    (typeof config === "object" && config.gracefulTimeout) ||
    Number.parseInt(globalThis.process?.env?.SERVER_SHUTDOWN_TIMEOUT || "") ||
    5;
  return seconds * 1000;
}
