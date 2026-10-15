import { defineHandler, setServerTiming } from "nitro/h3";

export default defineHandler((event) => {
  setServerTiming(event, "custom", { dur: 1, desc: "Custom" });
  return "ok";
});
