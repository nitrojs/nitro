export default defineCachedEventHandler(
  (event) => {
    return {
      timestamp: Date.now(),
      eventContextCache: event.context.cache,
    };
  },
  { swr: true, maxAge: 60 }
);
