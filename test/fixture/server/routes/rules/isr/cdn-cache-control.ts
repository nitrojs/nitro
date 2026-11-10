import { defineHandler } from "nitro/h3";

export default defineHandler((event) => {
  event.res.headers.set("netlify-cdn-cache-control", "no-store");
  return "ok";
});
