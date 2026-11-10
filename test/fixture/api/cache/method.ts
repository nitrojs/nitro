export default defineCachedEventHandler(
  (event) => {
    return { method: event.method, rand: Math.random() };
  },
  { swr: true, maxAge: 60 }
);
