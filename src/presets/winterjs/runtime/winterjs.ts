import "#nitro/virtual/polyfills";
import "./_polyfill.ts";

import type { ServerRequest, ServiceWorkerFetchEvent } from "srvx";
import { useNitroApp } from "nitro/app";

const nitroApp = useNitroApp();

// WinterJS runs service worker scripts: https://github.com/wasmerio/winterjs
addEventListener("fetch" as any, (event: ServiceWorkerFetchEvent) => {
  const request = event.request as ServerRequest;
  request.runtime ??= { name: "winterjs", serviceWorker: { event } };
  request.waitUntil = (promise) => event.waitUntil(promise as Promise<unknown>);
  event.respondWith(nitroApp.fetch(request));
});
