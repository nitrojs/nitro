import { handleCallback, send } from "@vercel/queue";
import { defineEventHandler, toWebRequest } from "h3";
import { useNitroApp } from "nitropack/runtime";

export default defineEventHandler((event) => {
  const nitroApp = useNitroApp();
  return handleCallback(async (message, metadata) => {
    try {
      await nitroApp.hooks.callHook("vercel:queue", {
        message,
        metadata,
        send,
      });
    } catch (error) {
      console.error("[vercel:queue]", error);
      nitroApp.captureError?.(error as Error, {
        event,
        tags: ["vercel:queue"],
      });
      // Rethrow so @vercel/queue schedules a retry.
      throw error;
    }
  })(toWebRequest(event));
});
