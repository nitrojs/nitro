import "#nitro-internal-pollyfills";
import { useNitroApp, useRuntimeConfig } from "nitro/runtime";
import { requestHasBody } from "nitro/runtime/internal";
import { getPublicAssetMeta } from "#nitro-internal-virtual/public-assets";

import {
  getAssetFromKV,
  mapRequestToAsset,
} from "@cloudflare/kv-asset-handler";
import wsAdapter from "crossws/adapters/cloudflare";
import { withoutBase } from "ufo";

addEventListener("fetch", (event: any) => {
  event.respondWith(handleEvent(event));
});

const nitroApp = useNitroApp();

const ws = import.meta._websocket
  ? wsAdapter(nitroApp.h3App.websocket)
  : undefined;

async function handleEvent(event: FetchEvent) {
  // Websocket upgrade
  // https://crossws.unjs.io/adapters/cloudflare
  if (
    import.meta._websocket &&
    event.request.headers.get("upgrade") === "websocket"
  ) {
    return ws!.handleUpgrade(event.request as any, {} /* env */, event as any);
  }

  try {
    return await getAssetFromKV(event, {
      cacheControl: assetsCacheControl,
      mapRequestToAsset: baseURLModifier,
    });
  } catch {
    // Ignore
  }

  const url = new URL(event.request.url);
  let body;
  if (requestHasBody(event.request)) {
    body = Buffer.from(await event.request.arrayBuffer());
  }

  return nitroApp.localFetch(url.pathname + url.search, {
    context: {
      // https://developers.cloudflare.com/workers//runtime-apis/request#incomingrequestcfproperties
      cf: (event.request as any).cf,
      waitUntil: (promise: Promise<any>) => event.waitUntil(promise),
      cloudflare: {
        event,
      },
    },
    host: url.hostname,
    protocol: url.protocol,
    headers: event.request.headers,
    method: event.request.method,
    redirect: event.request.redirect,
    body,
  });
}

function assetsCacheControl(_request: Request) {
  const url = new URL(_request.url);
  const meta = getPublicAssetMeta(url.pathname);
  if (meta.maxAge) {
    return {
      browserTTL: meta.maxAge,
      edgeTTL: meta.maxAge,
    };
  }
  return {};
}

const baseURLModifier = (request: Request) => {
  const url = withoutBase(request.url, useRuntimeConfig().app.baseURL);
  return mapRequestToAsset(new Request(url, request));
};
