export default defineNitroPlugin((app) => {
  app.hooks.hook("response", (res, req) => {
    const { pathname } = new URL(req.url);
    if (pathname.endsWith(".css") || pathname.endsWith(".js")) {
      res.headers.append("Vary", "Origin");
    }
  });
});
