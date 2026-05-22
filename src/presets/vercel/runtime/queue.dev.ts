import { send } from "@vercel/queue";
import { useRuntimeConfig } from "nitro/runtime-config";
import { registerVercelQueueConsumer } from "env-runner/runners/vercel/queue-dev";

import type { MessageMetadata } from "@vercel/queue";
import type { NitroAppPlugin } from "nitro/types";

interface DevTrigger {
  topic: string;
  retryAfterSeconds?: number;
  initialDelaySeconds?: number;
}

const queueDevPlugin: NitroAppPlugin = (nitroApp) => {
  const triggers =
    (useRuntimeConfig() as { vercel?: { queues?: { triggers?: DevTrigger[] } } }).vercel?.queues
      ?.triggers || [];

  if (triggers.length === 0) {
    return;
  }

  const unregisters: Array<() => void> = [];

  const ready = Promise.all(
    triggers.map((trigger) =>
      registerVercelQueueConsumer({
        topic: trigger.topic,
        retryAfterSeconds: trigger.retryAfterSeconds,
        handler: async (message: unknown, metadata: unknown) => {
          try {
            await nitroApp.hooks.callHook("vercel:queue", {
              message,
              metadata: metadata as MessageMetadata,
              send,
            });
          } catch (error) {
            console.error("[vercel:queue]", error);
            nitroApp.captureError?.(error as Error, {
              tags: ["vercel:queue"],
            });
            // Rethrow so @vercel/queue schedules a local retry.
            throw error;
          }
        },
      }).then((unregister) => {
        unregisters.push(unregister);
      })
    )
  ).catch((error) => {
    console.error("[vercel:queue] failed to register dev consumer:", error);
  });

  nitroApp.hooks.hook("close", async () => {
    await ready;
    for (const unregister of unregisters) {
      try {
        unregister();
      } catch {}
    }
  });
};

export default queueDevPlugin;
