import type { NitroShutdownContext } from "nitro/types";
import { useNitroHooks } from "nitro/app";

/**
 * Call the Nitro `shutdown` hooks, wait for the work they register with `waitUntil` for up to
 * `timeout` milliseconds, then call the `close` hooks.
 *
 * Neon sends `SIGINT` before stopping an isolate and stops it 5 seconds later, so the timeout
 * leaves time for the `close` hooks within that window.
 */
export async function shutdownNitro({ timeout }: { timeout: number }): Promise<void> {
  try {
    await callShutdownHooks(timeout);
    await useNitroHooks().callHook("close");
  } catch (error) {
    console.error("[nitro] Error while shutting down:", error);
  }
}

function callShutdownHooks(timeout: number): Promise<void> {
  const controller = new AbortController();
  return new Promise<void>((resolve) => {
    let pending = 0;
    const timer = setTimeout(() => {
      console.warn(`[nitro] Shutdown did not finish within ${timeout}ms.`);
      controller.abort();
      resolve();
    }, timeout);
    const waitUntil: NitroShutdownContext["waitUntil"] = (promise) => {
      pending++;
      Promise.resolve(promise)
        .catch((error) => console.error("[nitro] Error while shutting down:", error))
        .finally(() => {
          if (--pending === 0) {
            clearTimeout(timer);
            resolve();
          }
        });
    };
    waitUntil(
      Promise.resolve(
        useNitroHooks().callHook("shutdown", { waitUntil, signal: controller.signal })
      )
    );
  });
}
