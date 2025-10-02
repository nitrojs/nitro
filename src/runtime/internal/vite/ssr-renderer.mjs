import { defineHandler } from "h3";

export default defineHandler(function ssrRenderer(event) {
  return fetch(event.url, {
    viteEnv: "ssr",
    method: event.req.method,
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
    duplex: event.req.duplex,
  });
});
