import { defineHandler } from "h3";
import { findService } from "#nitro-vite-services";

export default defineHandler(async (event) => {
  const m = findService(event.req.method, event.url.pathname);
  if (!m) {
    return new Response("", { status: 404 });
  }
  return fetch(new URL(`/${m.params?._ || ""}${event.url.search}`, event.url), {
    viteEnv: m.data.service,
    method: event.req.method,
    // TODO: Clone headers or full RequestInit
    headers: event.req.headers,
    body: event.req.body,
    credentials: event.req.credentials,
    keepalive: event.req.keepalive,
    cache: event.req.cache,
    redirect: event.req.redirect,
    referrer: event.req.referrer,
    referrerPolicy: event.req.referrerPolicy,
    integrity: event.req.integrity,
    mode: event.req.mode,
  });
});
