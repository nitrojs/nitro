export default defineCachedEventHandler(
  (event) => {
    return {
      timestamp: Date.now(),
    };
  },
  { swr: true, maxAge: 60, allowQuery: ["q"] }
);
