export default defineCachedEventHandler(
  async (event) => {
    const sid = Math.random().toString(36).slice(2);
    await new Promise((resolve) => setTimeout(resolve, 50));
    setCookie(event, "sid", sid);
    setCookie(event, "csrf", sid);
    return { sid };
  },
  { swr: true, maxAge: 60 }
);
