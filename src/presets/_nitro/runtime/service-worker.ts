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

  event.respondWith(
    nitroApp.fetch(event.request, undefined, {
      _platform: { serviceWorker: { event } },
    })
  );
});

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
