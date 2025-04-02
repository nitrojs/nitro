export default eventHandler((event) => {
  event.res.headers.set("Content-Type", "text/plain; custom");
  return event.context.params!["test-id"];
});
