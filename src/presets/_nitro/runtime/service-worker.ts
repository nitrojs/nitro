import "#nitro/virtual/polyfills";
import { useNitroApp } from "nitro/app";
import { isPublicAssetURL } from "#nitro/virtual/public-assets";
import type { ServerRequest } from "srvx";

const nitroApp = useNitroApp();

// @ts-expect-error
addEventListener("fetch", (event: FetchEvent) => {
  const url = new URL(event.request.url);
  if (isPublicAssetURL(url.pathname) || url.pathname.includes("/_server/")) {
    return;
  }

  // srvx compatibility
  const req = event.request as unknown as ServerRequest;
  req.runtime ??= { name: "service-worker" };
  req.runtime.serviceWorker ??= { event } as any;
  req.waitUntil = event.waitUntil.bind(event);

  event.respondWith(nitroApp.fetch(req));
});

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
