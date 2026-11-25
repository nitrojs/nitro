import { defineCachedHandler } from "nitro/cache";
import { setServerTiming } from "nitro/h3";

export default defineCachedHandler(
  (event) => {
    setServerTiming(event, "handler", { dur: 2 });
    // A cache status from upstream (e.g. a proxied CDN response) is not Nitro's cache status,
    // even when it uses one of the same values
    event.res.headers.set("x-cache", "HIT");
    return { timestamp: Date.now() };
  },
  {
    name: "server-timing-handler",
    maxAge: 60,
    shouldBypassCache: (event) => event.req.url.endsWith("?bypass"),
  }
);
