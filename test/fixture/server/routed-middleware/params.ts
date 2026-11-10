import { defineHandler } from "nitro/h3";

export default defineHandler((event) => {
  return { middlewareParams: event.context.middlewareParams ?? null };
});
