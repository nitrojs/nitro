import { handleCallback, send } from "@vercel/queue";
import { defineHandler } from "nitro";
import { useNitroApp, useNitroHooks } from "nitro/app";

export default defineHandler((event) => {
  return handleCallback(async (message, metadata) => {
    try {
      await useNitroHooks().callHook("vercel:queue", { message, metadata, send });
    } catch (error) {
      console.error("[vercel:queue]", error);
      useNitroApp().captureError?.(error as Error, { event, tags: ["vercel:queue"] });
      throw error;
    }
  })(event.req as Request);
});
