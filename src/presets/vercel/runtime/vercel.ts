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
    const isrRoute = req.headers.get("x-now-route-matches");
    if (isrRoute) {
      const url = new URL(req.url);
      url.pathname = decodeURIComponent(isrRoute);
      req = new Request(url.toString(), req);
    }

    // srvx compatibility
    req.runtime ??= { name: "vercel" };
    // @ts-expect-error (add to srvx types)
    req.runtime.vercel = { context };
    req.waitUntil = context?.waitUntil;

    return nitroApp.fetch(req);
  },
};
