import { eventHandler, setResponseHeader } from "h3";

export default eventHandler((event) => {
  setResponseHeader(event, "content-type", "text/html");
  return "<!DOCTYPE html><html><body>slash</body></html>";
});
