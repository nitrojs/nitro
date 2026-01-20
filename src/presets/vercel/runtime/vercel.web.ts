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

    req.runtime = {
      name: "vercel",
      // @ts-expect-error (add to srvx types)
      vercel: { context },
    };

    let ip: string | undefined;
    Object.defineProperty(req, "ip", {
      get() {
        const h = req.headers.get("x-forwarded-for");
        return (ip ??= h?.split(",").shift()?.trim());
      },
    });

    req.waitUntil = context?.waitUntil;

    return nitroApp.fetch(req);
  },
};
