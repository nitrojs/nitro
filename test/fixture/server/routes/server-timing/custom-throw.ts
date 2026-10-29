import { defineHandler, HTTPError, setServerTiming } from "nitro/h3";

export default defineHandler((event) => {
  setServerTiming(event, "custom", { dur: 1, desc: "Custom" });
  throw new HTTPError({ status: 503, message: "Unavailable" });
});
