export default defineCachedEventHandler(
  (event) => {
    setResponseHeader(event, "vary", "x-user");
    return { rand: Math.random() };
  },
  { swr: true, maxAge: 60 }
);
