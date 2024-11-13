export default eventHandler((event) => {
  setHeader(event, "Content-Type", "text/plain; charset=utf-16");
  return event.context.params!["test-id"];
});
