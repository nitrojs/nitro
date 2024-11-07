export default defineNitroPlugin((app) => {
  app.hooks.hook("request", (event) => {
    if (event.path.endsWith(".css")) {
      setResponseHeader(event, "Vary", "Origin");
    }
    if (event.path.endsWith(".js")) {
      setResponseHeader(event, "Vary", ["Origin"]);
    }
  });
});
