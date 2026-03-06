import { defineCachedHandler } from "nitro/cache";

export default defineCachedHandler(
  (event) => {
    return {
      timestamp: Date.now(),
    };
  },
  { swr: true, maxAge: 60, allowQuery: ["q"] }
);
