import { defineHandler } from "nitro/h3";

export default defineHandler((event) => {
  event.res.headers.set("content-type", "text/html");
  return "<!DOCTYPE html><html><body>slash</body></html>";
});
