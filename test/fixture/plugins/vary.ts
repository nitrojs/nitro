export default defineNitroPlugin((app) => {
  app.hooks.hook("response", (res, event) => {
    const { pathname } = new URL(event.req.url);
    if (pathname.endsWith(".css") || pathname.endsWith(".js")) {
      res.headers.append("Vary", "Origin");
    }
  });
});
