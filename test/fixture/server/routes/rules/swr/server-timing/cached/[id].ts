import { defineHandler, setServerTiming } from "nitro/h3";

export default defineHandler((event) => {
  setServerTiming(event, "handler", { dur: 2 });
  return { timestamp: Date.now() };
});
