import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";
import { isPublicAssetURL } from "#nitro-internal-virtual/public-assets";

const nitroApp = useNitroApp();

// @ts-expect-error
addEventListener("fetch", (event: FetchEvent) => {
  const url = new URL(event.request.url);
  if (isPublicAssetURL(url.pathname) || url.pathname.includes("/_server/")) {
    return;
  }

  event.respondWith(handleEvent(url, event));
});

async function handleEvent(url: URL, event: FetchEvent) {
  let body;
  if (event.request.body) {
    body = await event.request.arrayBuffer();
  }

  return nitroApp.localFetch(url.pathname + url.search, {
    host: url.hostname,
    protocol: url.protocol,
    headers: event.request.headers,
    method: event.request.method,
    redirect: event.request.redirect,
    body,
  });
}

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
