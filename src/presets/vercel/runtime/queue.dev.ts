import { defineNitroPlugin, useRuntimeConfig } from "nitropack/runtime";

import type { MessageHandler, QueueClient } from "@vercel/queue";

// `@vercel/queue` gates local `send()` routing behind `isDevMode()`, which
// checks `process.env.NODE_ENV === "development"`. This plugin is only ever
// loaded by the dev-only `vercel-dev` preset, so defaulting it here is safe
// and never affects production builds. Bracket access avoids the dev
// bundler's static `process.env.NODE_ENV` replacement (which would otherwise
// rewrite this into an assignment to a string literal).
process.env["NODE_ENV"] ??= "development";

const CONSUMER_GROUP = "nitro-vercel-dev";

interface DevTrigger {
  topic: string;
  retryAfterSeconds?: number;
}

type VercelQueueSdk = typeof import("@vercel/queue");

let sdkPromise: Promise<VercelQueueSdk | null> | undefined;
let client: QueueClient | undefined;

/**
 * Lazily load `@vercel/queue` and construct a shared `QueueClient`.
 *
 * Resolves to `null` (and logs a one-time warning) when the package is not
 * installed or is too old to expose `registerDevConsumer` (added in
 * `@vercel/queue@^0.2.0`), so registrations become no-ops.
 */
function ensureSdk(): Promise<VercelQueueSdk | null> {
  if (sdkPromise) {
    return sdkPromise;
  }
  sdkPromise = (async () => {
    let mod: VercelQueueSdk;
    try {
      mod = await import("@vercel/queue");
    } catch {
      console.warn(
        "[vercel:queue] `@vercel/queue` is not installed. Local queue delivery is disabled."
      );
      return null;
    }
    if (typeof mod.registerDevConsumer !== "function") {
      console.warn(
        "[vercel:queue] Installed `@vercel/queue` does not export `registerDevConsumer`. Upgrade to `@vercel/queue@^0.2.0` to enable local queue delivery."
      );
      return null;
    }
    client = new mod.QueueClient();
    return mod;
  })();
  return sdkPromise;
}

export default defineNitroPlugin((nitroApp) => {
  const triggers =
    (
      useRuntimeConfig() as {
        vercel?: { queues?: { triggers?: DevTrigger[] } };
      }
    ).vercel?.queues?.triggers || [];

  if (triggers.length === 0) {
    return;
  }

  const unregisters: Array<() => void> = [];

  const ready = (async () => {
    const sdk = await ensureSdk();
    if (!sdk || !client) {
      return;
    }
    for (const trigger of triggers) {
      const handler: MessageHandler = async (message, metadata) => {
        try {
          await nitroApp.hooks.callHook("vercel:queue", {
            message,
            metadata,
            send: sdk.send,
          });
        } catch (error) {
          console.error("[vercel:queue]", error);
          nitroApp.captureError?.(error as Error, {
            tags: ["vercel:queue"],
          });
          // Rethrow so @vercel/queue schedules a local retry.
          throw error;
        }
      };

      // Compare against `undefined` so a configured `0` is honored.
      const { retryAfterSeconds } = trigger;
      unregisters.push(
        sdk.registerDevConsumer({
          topic: trigger.topic,
          client,
          consumerGroup: CONSUMER_GROUP,
          retry:
            retryAfterSeconds === undefined
              ? undefined
              : () => ({ afterSeconds: retryAfterSeconds }),
          handler,
        })
      );
    }
  })().catch((error) => {
    console.error("[vercel:queue] failed to register dev consumer:", error);
  });

  nitroApp.hooks.hook("close", async () => {
    await ready;
    for (const unregister of unregisters) {
      try {
        unregister();
      } catch {
        // ignore unregister failures during shutdown
      }
    }
  });
});
