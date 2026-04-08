import { handleCallback } from "@vercel/queue";
import { defineHandler } from "nitro";
import { useNitroHooks } from "nitro/app";
import { send } from '@vercel/queue';

export default defineHandler((event) => {
  return handleCallback(async (message, metadata) => {
    await useNitroHooks().callHook("vercel:queue", { message, metadata, send  });
  })(event.req as Request);
});
