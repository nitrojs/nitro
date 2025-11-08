import { defineCachedHandler } from "nitro/cache";

export default defineCachedHandler(
  (event) => {
    return {
      timestamp: Date.now(),
      eventContextCache: event.context.cache,
    };
  },
  { swr: true, maxAge: 60 }
);
