import type { NitroShutdownContext } from "nitro/types";
import { useNitroHooks } from "nitro/app";

const inflight = new Set<Promise<void>>();
let shutdownWaitUntil: NitroShutdownContext["waitUntil"] | undefined;

/**
 * Keep a shutdown pending until `promise` settles: use it for requests and for the work they
 * register with `waitUntil`.
 */
export function trackInflight<T>(promise: Promise<T>): Promise<T> {
  const settled = promise.then(
    () => {},
    () => {}
  );
  inflight.add(settled);
  settled.finally(() => inflight.delete(settled));
  shutdownWaitUntil?.(settled);
  return promise;
}

/**
 * Keep a shutdown pending until the response body is fully sent, cancelled or failed. The body
 * is read one chunk at a time as the client pulls it, so it is never buffered.
 */
export function trackResponse(response: Response): Response {
  const body = response.body;
  if (!body) {
    return response;
  }
  let settle!: () => void;
  trackInflight(new Promise<void>((resolve) => (settle = resolve)));
  const reader = body.getReader();
  const tracked = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          settle();
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        settle();
        controller.error(error);
      }
    },
    cancel(reason) {
      settle();
      return reader.cancel(reason);
    },
  });
  return new Response(tracked, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/**
 * Call the Nitro `shutdown` hooks, then wait for in-flight requests and the work registered
 * with `waitUntil` for up to `timeout` milliseconds, then call the `close` hooks.
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
    shutdownWaitUntil = waitUntil;
    for (const promise of inflight) {
      waitUntil(promise);
    }
    waitUntil(
      Promise.resolve(
        useNitroHooks().callHook("shutdown", { waitUntil, signal: controller.signal })
      )
    );
  });
}
