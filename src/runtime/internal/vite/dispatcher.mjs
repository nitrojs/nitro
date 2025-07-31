import { defineHandler } from "h3";
import { findService } from "#nitro-vite-services";

export default defineHandler(async (event) => {
  const m = findService(event.req.method, event.url.pathname);
  if (!m) {
    return new Response("", { status: 404 });
  }
  return fetch(new URL(`/${m.params?._ || ""}${event.url.search}`, event.url), {
    viteEnv: m.data.service,
  });
});
