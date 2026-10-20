import { defineCachedHandler } from "nitro/cache";
import { setServerTiming } from "nitro/h3";

export default defineCachedHandler(
  (event) => {
    setServerTiming(event, "handler", { dur: 1 });
    // A cache status from upstream (e.g. a proxied CDN response) is not Nitro's cache status
    event.res.headers.set("x-cache", 'Hit from "upstream"');
    return { timestamp: Date.now() };
  },
  {
    name: "server-timing-handler",
    maxAge: 60,
    shouldBypassCache: (event) => event.req.url.endsWith("?bypass"),
  }
);
