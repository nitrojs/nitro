import "#nitro-internal-polyfills";
import { useNitroApp, getRouteRules } from "nitro/app";

import type { ServerRequest } from "srvx";
import { isrRouteRewrite } from "./isr.ts";

const nitroApp = useNitroApp();

export default {
  fetch(
    req: ServerRequest,
    context: { waitUntil: (promise: Promise<any>) => void }
  ) {
    // ISR route rewrite
    const isrURL = isrRouteRewrite(
      req.url,
      req.headers.get("x-now-route-matches")
    );
    if (isrURL) {
      const { routeRules } = getRouteRules("", isrURL);
      if (routeRules?.isr) {
        req = new Request(new URL(isrURL, req.url).href, req);
      }
    }

    // srvx compatibility
    req.runtime ??= { name: "vercel" };

    // @ts-expect-error (add to srvx types)
    req.runtime.vercel = { context };
    req.waitUntil = context?.waitUntil;

    return nitroApp.fetch(req);
  },
};
