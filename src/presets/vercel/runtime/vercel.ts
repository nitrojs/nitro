import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";

import type { ServerRequest } from "srvx";

const nitroApp = useNitroApp();

export default {
  fetch(
    req: ServerRequest,
    context: { waitUntil: (promise: Promise<any>) => void }
  ) {
    // Check for ISR request
    const url = new URL(req.url);
    let isISR = false;
    const isrRoute = req.headers.get("x-now-route-matches");
    if (isrRoute) {
      url.pathname = decodeURIComponent(isrRoute);
      req = new Request(url.toString(), req);
      isISR = true;
    }

    // srvx compatibility
    req.runtime ??= { name: "vercel" };
    req.context = context;
    req.waitUntil = context?.waitUntil;

    return nitroApp.fetch(req);
  },
};
