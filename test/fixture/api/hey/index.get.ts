export default eventHandler((event) => {
  event.res.headers.set("Content-Type", "text/html");
  return "Hey API";
});
