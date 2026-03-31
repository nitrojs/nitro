import { handleCallback } from "@vercel/queue";
import { defineHandler } from "nitro";
import { useNitroHooks } from "nitro/app";

export default defineHandler((event) => {
  return handleCallback(async (message, metadata) => {
    await useNitroHooks().callHook("vercel:queue", { message, metadata });
  })(event.req as Request);
});
