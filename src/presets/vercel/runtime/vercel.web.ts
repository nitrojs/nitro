import "#nitro/virtual/polyfills";
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
      const { routeRules } = getRouteRules("", isrURL[0]);
      if (routeRules?.isr) {
        req = new Request(
          new URL(isrURL[0] + (isrURL[1] ? `?${isrURL[1]}` : ""), req.url).href,
          req
        );
      }
    }

    // srvx compatibility
    req.runtime ??= { name: "vercel" };
    // there's also x-vercel-forwarded-for, x-vercel-proxied-for, x-real-ip
    req.ip = req.headers.get("x-forwarded-for") || undefined;
    // @ts-expect-error (add to srvx types)
    req.runtime.vercel = { context };
    req.waitUntil = context?.waitUntil;

    return nitroApp.fetch(req);
  },
};
