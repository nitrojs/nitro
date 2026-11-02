import { defineHandler } from "nitro";

export default defineHandler((event) => {
  event.res.headers.set("x-handler", "get");
  return "secret";
});
