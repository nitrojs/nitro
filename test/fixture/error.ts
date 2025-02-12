export default defineNitroErrorHandler((error, event) => {
  if (event.path.includes("?custom_error_handler")) {
    return send(event, "custom_error_handler");
  }
});
