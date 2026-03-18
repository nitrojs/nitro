import { handleCallback } from "@vercel/queue";
import { defineHandler } from "nitro";
import { useNitroHooks } from "nitro/app";

const handler = handleCallback(async (message, metadata) => {
  await useNitroHooks().callHook("vercel:queue", { message, metadata });
});

export default defineHandler((event) => {
  return handler(event.req as Request);
});
