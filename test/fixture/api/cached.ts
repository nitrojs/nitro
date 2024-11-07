export default defineCachedEventHandler((event) => {
  return {
    timestamp: Date.now(),
    eventContextCache: event.context.cache,
  };
});
