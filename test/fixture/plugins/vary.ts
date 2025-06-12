export default defineNitroPlugin((app) => {
  app.hooks.hook("request", (event) => {
    if (
      event.url.pathname.endsWith(".css") ||
      event.url.pathname.endsWith(".js")
    ) {
      event.res.headers.set("Vary", "Origin");
    }
  });
});
