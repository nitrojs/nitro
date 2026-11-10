export default defineCachedEventHandler(
  (event) => {
    setResponseHeader(event, "cache-control", "no-store");
    return { rand: Math.random() };
  },
  { swr: true, maxAge: 60 }
);
