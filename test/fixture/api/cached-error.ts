import { cachedErrorShouldError } from "../utils/cached-error-state";

export default defineCachedEventHandler(
  () => {
    if (cachedErrorShouldError) {
      throw createError({ statusCode: 404, statusMessage: "Not found" });
    }
    return {
      timestamp: Date.now(),
    };
  },
  { swr: true, maxAge: 1 }
);
